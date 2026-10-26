ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS pricing_period TEXT NOT NULL DEFAULT 'daily',
    ADD COLUMN IF NOT EXISTS rate_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS billed_units INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS base_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS service_fee_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'RWF',
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS bookings_pricing_period_check;
ALTER TABLE bookings
    ADD CONSTRAINT bookings_pricing_period_check
    CHECK (pricing_period IN ('daily', 'monthly'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_guest_idempotency
    ON bookings (guest_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS provider_transaction_id TEXT,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments
    ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'successful', 'failed', 'expired', 'refunded'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_reference
    ON payments (provider, provider_reference)
    WHERE provider_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_transaction_id
    ON payments (provider, provider_transaction_id)
    WHERE provider_transaction_id IS NOT NULL;
