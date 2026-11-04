-- Komisiyoneri accounts publish by consuming purchased slots. Landlord
-- accounts use an admin-configured fixed marketplace fee. Only Property
-- Owners use property-value percentage pricing.
UPDATE marketplace_listing_fee_rules
SET rate_percent = 0, updated_at = NOW()
WHERE role IN ('komisiyoneri', 'landlord');
