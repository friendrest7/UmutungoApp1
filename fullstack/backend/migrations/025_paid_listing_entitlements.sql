ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
UPDATE users SET phone_verified_at=verified_at WHERE phone_verified_at IS NULL AND verified_at IS NOT NULL AND phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS marketplace_listing_fee_rules (
    role TEXT NOT NULL CHECK (role IN ('komisiyoneri','property_owner','landlord')),
    price_min NUMERIC(14,2) NOT NULL CHECK (price_min >= 0),
    price_max NUMERIC(14,2),
    rate_percent NUMERIC(7,4) NOT NULL CHECK (rate_percent >= 0),
    fixed_fee NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (fixed_fee >= 0),
    currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency='RWF'),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(role,price_min),
    CHECK (price_max IS NULL OR price_max > price_min)
);

INSERT INTO marketplace_listing_fee_rules(role,price_min,price_max,rate_percent)
SELECT roles.role, bands.price_min, bands.price_max, bands.rate_percent
FROM (VALUES
    (0::numeric,300000::numeric,1.0::numeric),
    (300000::numeric,1000000::numeric,2.0::numeric),
    (1000000::numeric,10000000::numeric,3.0::numeric),
    (10000000::numeric,30000000::numeric,3.1::numeric),
    (30000000::numeric,100000000::numeric,3.2::numeric),
    (100000000::numeric,NULL::numeric,1.2::numeric)
) AS bands(price_min,price_max,rate_percent)
CROSS JOIN (VALUES ('komisiyoneri'),('property_owner'),('landlord')) AS roles(role)
ON CONFLICT(role,price_min) DO NOTHING;

CREATE TABLE IF NOT EXISTS listing_upload_packages (
    package_key TEXT PRIMARY KEY CHECK (package_key ~ '^[a-z0-9][a-z0-9_-]{1,49}$'),
    label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
    slot_count INTEGER NOT NULL CHECK (slot_count > 0),
    price NUMERIC(14,2) NOT NULL CHECK (price > 0),
    currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency='RWF'),
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_upload_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id),
    package_key TEXT NOT NULL REFERENCES listing_upload_packages(package_key),
    slot_count INTEGER NOT NULL CHECK (slot_count > 0),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency='RWF'),
    payment_id UUID UNIQUE REFERENCES payments(id),
    provider_reference TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','failed','cancelled')),
    provider_transaction_id TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id,idempotency_key)
);

CREATE TABLE IF NOT EXISTS listing_upload_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES listing_upload_purchases(id),
    owner_id UUID NOT NULL REFERENCES users(id),
    listing_id UUID UNIQUE REFERENCES listings(id),
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','consumed','revoked')),
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS listing_upload_slots_owner_available_idx ON listing_upload_slots(owner_id,created_at) WHERE status='available';
CREATE INDEX IF NOT EXISTS listing_upload_purchases_owner_idx ON listing_upload_purchases(owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_listing_fee_rules_enabled_idx ON marketplace_listing_fee_rules(role,price_min) WHERE enabled;
