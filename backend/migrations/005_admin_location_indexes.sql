-- Safe location upgrade: preserve existing administrative data while making
-- dependent-level reads predictable for the admin and posting forms.
CREATE INDEX IF NOT EXISTS idx_administrative_locations_hierarchy
    ON administrative_locations (province, district, sector, cell, village);

CREATE INDEX IF NOT EXISTS idx_administrative_locations_district
    ON administrative_locations (province, district);
