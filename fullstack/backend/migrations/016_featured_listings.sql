ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_listings_featured_published
    ON listings (is_featured DESC, created_at DESC)
    WHERE status = 'published' AND deleted_at IS NULL;
