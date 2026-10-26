ALTER TABLE otp_challenges
    ADD COLUMN IF NOT EXISTS attempts SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_otp_expiry
    ON otp_challenges (expires_at)
    WHERE used_at IS NULL;
