CREATE TABLE IF NOT EXISTS owner_upgrade_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('silver', 'gold', 'platinum')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'RWF',
    payment_id UUID UNIQUE REFERENCES payments(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed', 'expired')),
    transaction_reference TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    purchased_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    provider_transaction_id TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_owner_upgrade_purchases_owner_created
    ON owner_upgrade_purchases(owner_id, created_at DESC);
