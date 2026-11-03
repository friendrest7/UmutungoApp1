ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE payments ADD CONSTRAINT payments_provider_check
    CHECK (provider IN ('mtn_momo', 'airtel_money', 'card', 'manual', 'flutterwave'));

CREATE TABLE IF NOT EXISTS listing_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
    monthly_amount NUMERIC(14,2) NOT NULL CHECK (monthly_amount > 0),
    rate_percent NUMERIC(5,2) NOT NULL CHECK (rate_percent > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed')),
    requested_status TEXT NOT NULL DEFAULT 'published' CHECK (requested_status IN ('published', 'scheduled')),
    publish_at TIMESTAMPTZ,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listing_subscriptions_owner
    ON listing_subscriptions(owner_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_subscriptions_one_pending_per_listing
    ON listing_subscriptions(listing_id)
    WHERE status = 'pending';
