-- Mobile Google accounts do not necessarily expose a phone number.
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email)) WHERE email IS NOT NULL;
