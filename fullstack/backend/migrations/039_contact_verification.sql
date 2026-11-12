-- Email + phone verification with one-time codes.

-- When the user proved they own their email address (NULL = not verified).
-- phone_verified_at already exists (migration 025).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Old codes were hashed with plain SHA-256 and can't be checked by the new
-- keyed (HMAC) hashing, so clear them. Anyone mid-login just requests a new one.
DELETE FROM otp_challenges;

-- otp_challenges held SMS codes only. It now holds email codes too, so the
-- "phone" column becomes a general "destination" (a phone or an email address).
ALTER TABLE otp_challenges RENAME COLUMN phone TO destination;
ALTER TABLE otp_challenges
    ADD COLUMN channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
    -- What the code unlocks: signing in, changing phone, or verifying email.
    ADD COLUMN purpose TEXT NOT NULL CHECK (purpose IN ('login', 'change_phone', 'verify_email')),
    -- The account the code belongs to, so a code can't be used on another account.
    ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE;
-- Codes are now deleted on use instead of being marked used. Drop the old
-- indexes that filtered on used_at first.
DROP INDEX IF EXISTS idx_otp_expiry;
DROP INDEX IF EXISTS idx_otp_phone_latest;
ALTER TABLE otp_challenges DROP COLUMN IF EXISTS used_at;

CREATE INDEX IF NOT EXISTS idx_otp_lookup
    ON otp_challenges (channel, purpose, destination, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_challenges (expires_at);

-- One row per "send code" request, used only for rate limiting. Kept separate
-- from otp_challenges because codes are deleted after use, which would also
-- erase the send history the limits count. The destination is stored as a
-- keyed hash, so this table never holds raw phone numbers or email addresses.
CREATE TABLE IF NOT EXISTS otp_send_events (
    id BIGSERIAL PRIMARY KEY,
    destination_hash TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_send_events_destination ON otp_send_events (destination_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_send_events_ip ON otp_send_events (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_send_events_created ON otp_send_events (created_at);
