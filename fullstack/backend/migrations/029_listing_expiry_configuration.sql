ALTER TABLE marketplace_listing_fee_rules ADD COLUMN IF NOT EXISTS default_expiry_days INTEGER NOT NULL DEFAULT 90 CHECK (default_expiry_days > 0);
UPDATE marketplace_listing_fee_rules SET default_expiry_days=30 WHERE role='komisiyoneri';
UPDATE marketplace_listing_fee_rules SET default_expiry_days=90 WHERE role IN ('property_owner','landlord');
