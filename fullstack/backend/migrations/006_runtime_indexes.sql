-- Keep the public feed, authentication, and owner/tenant workspaces fast as
-- the marketplace grows. These indexes are additive and safe to re-run.
CREATE INDEX IF NOT EXISTS idx_listings_public_feed
    ON listings (status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listing_media_listing_sort
    ON listing_media (listing_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_otp_phone_latest
    ON otp_challenges (phone, created_at DESC)
    WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry
    ON sessions (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_listing_status
    ON rental_applications (listing_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_guest_created
    ON bookings (guest_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_user_created
    ON payments (user_id, created_at DESC);
