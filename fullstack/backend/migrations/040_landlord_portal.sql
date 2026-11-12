-- Landlord portal: announcements, rent reminder rules and a reminder log.
-- Additive only. Everything is scoped to the owner who created it.

CREATE TABLE IF NOT EXISTS owner_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- NULL means "all my tenants".
    property_id UUID REFERENCES managed_properties(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS owner_announcements_owner_created_idx ON owner_announcements(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS owner_reminder_settings (
    owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    auto_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    days_before SMALLINT NOT NULL DEFAULT 3 CHECK (days_before BETWEEN 0 AND 30),
    overdue_interval SMALLINT NOT NULL DEFAULT 3 CHECK (overdue_interval BETWEEN 1 AND 30),
    send_on_due BOOLEAN NOT NULL DEFAULT TRUE,
    upcoming_message TEXT NOT NULL DEFAULT 'Hello {tenant}, your rent of {amount} is due on {due_date}.' CHECK (char_length(upcoming_message) BETWEEN 1 AND 500),
    due_today_message TEXT NOT NULL DEFAULT 'Hello {tenant}, your rent of {amount} is due today ({due_date}).' CHECK (char_length(due_today_message) BETWEEN 1 AND 500),
    overdue_message TEXT NOT NULL DEFAULT 'Hello {tenant}, your rent of {amount} was due on {due_date} and is now overdue.' CHECK (char_length(overdue_message) BETWEEN 1 AND 500),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per reminder prepared for a rent charge. Used to avoid repeating the
-- same reminder and to space out overdue reminders.
CREATE TABLE IF NOT EXISTS owner_rent_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    charge_id UUID NOT NULL REFERENCES owner_rent_charges(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('upcoming', 'due_today', 'overdue')),
    message TEXT NOT NULL,
    trigger TEXT NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'automatic')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS owner_rent_reminders_charge_idx ON owner_rent_reminders(charge_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS owner_rent_reminders_owner_idx ON owner_rent_reminders(owner_id, created_at DESC);
