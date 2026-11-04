ALTER TABLE users ADD COLUMN IF NOT EXISTS property_owner_enabled BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET property_owner_enabled=TRUE WHERE role='property_owner' AND workspace_kind<>'landlord';
