-- Business subscription plans for Landlords, Property Owners, and Komisiyoneri.
--
-- Plans are versioned: an admin edit inserts a new version and marks it
-- current. Each subscription stores the entitlements it was sold with, so a
-- later price or limit change never alters what an existing customer paid for.
--
-- Every seeded plan starts DISABLED. Nothing changes for live customers until
-- an administrator reviews prices and limits and enables the plan.

CREATE TABLE IF NOT EXISTS plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_role TEXT NOT NULL CHECK (business_role IN ('landlord', 'property_owner', 'komisiyoneri')),
    tier TEXT NOT NULL CHECK (tier IN ('silver', 'gold', 'platinum')),
    version INTEGER NOT NULL CHECK (version > 0),
    label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
    description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
    price NUMERIC(14,2) NOT NULL CHECK (price > 0),
    currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency = 'RWF'),
    period_days INTEGER NOT NULL CHECK (period_days BETWEEN 1 AND 366),
    -- NULL listing_limit means unlimited, still bounded by fair_use_listing_cap.
    listing_limit INTEGER CHECK (listing_limit IS NULL OR listing_limit >= 0),
    fair_use_listing_cap INTEGER NOT NULL DEFAULT 500 CHECK (fair_use_listing_cap > 0),
    photo_limit_per_listing INTEGER NOT NULL DEFAULT 10 CHECK (photo_limit_per_listing > 0),
    video_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    video_limit_per_listing INTEGER NOT NULL DEFAULT 0 CHECK (video_limit_per_listing >= 0),
    max_video_seconds INTEGER NOT NULL DEFAULT 0 CHECK (max_video_seconds >= 0),
    max_video_mb INTEGER NOT NULL DEFAULT 0 CHECK (max_video_mb >= 0),
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_role, tier, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS plan_versions_one_current_idx
    ON plan_versions (business_role, tier) WHERE is_current;

-- Seed version 1 for each role and tier. Prices and durations copy the
-- currently configured premium offers; limits follow the product brief where
-- it is explicit (Silver: 30 listings, Platinum: unlimited with fair use).
-- Gold's limit is a placeholder equal to Silver and the admin API refuses to
-- enable Gold until it is set higher than Silver.
INSERT INTO plan_versions (business_role, tier, version, label, price, period_days, listing_limit,
    photo_limit_per_listing, video_enabled, video_limit_per_listing, max_video_seconds, max_video_mb, features, enabled)
SELECT roles.business_role, tiers.tier, 1, initcap(tiers.tier),
    COALESCE((SELECT price FROM marketplace_premium_offers o WHERE o.offer_key = tiers.tier AND o.price > 0), tiers.fallback_price),
    LEAST(366, GREATEST(1, COALESCE((SELECT NULLIF(duration_days, 0) FROM marketplace_premium_offers o WHERE o.offer_key = tiers.tier), 30))),
    tiers.listing_limit, tiers.photos, tiers.video, tiers.videos, tiers.video_seconds, tiers.video_mb, tiers.features, FALSE
FROM (VALUES ('landlord'), ('property_owner'), ('komisiyoneri')) AS roles(business_role)
CROSS JOIN (VALUES
    ('silver',   10000::numeric, 30,          10, FALSE, 0, 0,   0,   '["photo_uploads","basic_analytics","standard_promotion","inventory_management"]'::jsonb),
    ('gold',     20000::numeric, 30,          20, TRUE,  1, 120, 100, '["photo_uploads","video_uploads","basic_analytics","advanced_analytics","standard_promotion","recommended_eligible","search_boost","priority_inquiries","inventory_management"]'::jsonb),
    ('platinum', 30000::numeric, NULL::int,   30, TRUE,  3, 300, 250, '["photo_uploads","video_uploads","basic_analytics","advanced_analytics","business_analytics","standard_promotion","recommended_eligible","search_boost","priority_inquiries","premium_presentation","priority_support","business_verification","ad_free","inventory_management"]'::jsonb)
) AS tiers(tier, fallback_price, listing_limit, photos, video, videos, video_seconds, video_mb, features)
ON CONFLICT (business_role, tier, version) DO NOTHING;

-- Extend the original (previously unused in production) subscriptions table.
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS business_role TEXT CHECK (business_role IS NULL OR business_role IN ('landlord', 'property_owner', 'komisiyoneri')),
    ADD COLUMN IF NOT EXISTS plan_version_id UUID REFERENCES plan_versions(id),
    ADD COLUMN IF NOT EXISTS payment_id UUID UNIQUE REFERENCES payments(id),
    ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2),
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'RWF',
    ADD COLUMN IF NOT EXISTS entitlements JSONB,
    ADD COLUMN IF NOT EXISTS change_kind TEXT NOT NULL DEFAULT 'new' CHECK (change_kind IN ('new', 'renewal', 'upgrade', 'downgrade')),
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES subscriptions(id),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'failed', 'superseded'));

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_idempotency_idx
    ON subscriptions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_user_role_active_idx
    ON subscriptions (user_id, business_role, status, ends_at);

-- Record which entitlement published each listing so plan allowance can be
-- counted and released precisely. '' = legacy (published before this change).
ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS entitlement_source TEXT NOT NULL DEFAULT ''
        CHECK (entitlement_source IN ('', 'plan', 'listing_payment', 'credit', 'admin'));
ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS paused_reason TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS listings_owner_plan_active_idx
    ON listings (owner_id, status) WHERE entitlement_source = 'plan' AND deleted_at IS NULL;

-- Platform-wide settings an administrator can edit without a deploy.
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY CHECK (key ~ '^[a-z][a-z0-9_]{1,63}$'),
    value JSONB NOT NULL,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO platform_settings (key, value) VALUES ('subscription_grace_days', '3'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Listing fee rules may now target a property category and/or transaction
-- type. The most specific enabled rule wins. Existing rules are unchanged and
-- keep applying to every category (NULL = any).
ALTER TABLE marketplace_listing_fee_rules
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS transaction_type TEXT;
ALTER TABLE marketplace_listing_fee_rules DROP CONSTRAINT IF EXISTS marketplace_listing_fee_rules_pkey;
ALTER TABLE marketplace_listing_fee_rules ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE marketplace_listing_fee_rules ADD CONSTRAINT marketplace_listing_fee_rules_pkey PRIMARY KEY (id);
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_listing_fee_rules_scope_idx
    ON marketplace_listing_fee_rules (role, COALESCE(category, ''), COALESCE(transaction_type, ''), price_min);
