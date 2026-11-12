-- Links a landlord's private property (units, tenants, rent) to the public
-- marketplace listing that advertises it. A listing advertises at most one
-- property. Additive only.
ALTER TABLE managed_properties ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES listings(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS managed_properties_listing_idx ON managed_properties(listing_id) WHERE listing_id IS NOT NULL;
