-- Safe upgrade for databases that already applied 001_init before the
-- tenant payment, messaging, viewing, and review additions were introduced.
ALTER TABLE rental_applications ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, listing_id, created_at DESC);

-- Public directory and moderation queries use these indexes without changing
-- any existing user, listing, or report data.
CREATE INDEX IF NOT EXISTS idx_users_directory ON users(role, status, name);
CREATE INDEX IF NOT EXISTS idx_listings_owner_published ON listings(owner_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);
