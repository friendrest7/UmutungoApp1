ALTER TABLE owner_upgrade_purchases
    DROP CONSTRAINT IF EXISTS owner_upgrade_purchases_plan_check;

ALTER TABLE owner_upgrade_purchases
    ADD CONSTRAINT owner_upgrade_purchases_plan_check
    CHECK (plan IN ('silver', 'gold', 'platinum', 'diamond'));

ALTER TABLE owner_upgrade_purchases
    ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES listings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_owner_upgrade_purchases_listing
    ON owner_upgrade_purchases(listing_id, status)
    WHERE plan = 'diamond';
