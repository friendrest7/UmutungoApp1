ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_provider_check;
ALTER TABLE payments ADD CONSTRAINT payments_provider_check
    CHECK (provider IN ('mtn_momo', 'airtel_money', 'card', 'manual', 'flutterwave', 'demo'));
