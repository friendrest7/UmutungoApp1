ALTER TABLE owner_upgrade_purchases
    ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE owner_upgrade_purchases
    DROP CONSTRAINT IF EXISTS owner_upgrade_purchases_amount_check;

ALTER TABLE owner_upgrade_purchases
    ADD CONSTRAINT owner_upgrade_purchases_amount_check
    CHECK (amount > 0 OR (is_demo AND amount = 0));
