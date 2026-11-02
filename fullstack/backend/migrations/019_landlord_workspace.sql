ALTER TABLE users ADD COLUMN IF NOT EXISTS workspace_kind TEXT NOT NULL DEFAULT '' CHECK (workspace_kind IN ('', 'landlord', 'property_owner'));

-- Physical records are private workspace data and are deliberately separate
-- from public marketplace listings.
CREATE TABLE IF NOT EXISTS managed_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
    province TEXT NOT NULL,
    district TEXT NOT NULL,
    sector TEXT NOT NULL,
    cell TEXT NOT NULL DEFAULT '',
    village TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS managed_properties_owner_created_idx ON managed_properties(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS managed_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES managed_properties(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    monthly_rent BIGINT NOT NULL CHECK (monthly_rent >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(property_id, name)
);
CREATE INDEX IF NOT EXISTS managed_units_owner_idx ON managed_units(owner_id, property_id);

CREATE TABLE IF NOT EXISTS owner_rent_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES managed_units(id) ON DELETE CASCADE,
    tenant_name TEXT NOT NULL,
    tenant_phone TEXT NOT NULL,
    amount_due BIGINT NOT NULL CHECK (amount_due > 0),
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS owner_rent_charges_owner_due_idx ON owner_rent_charges(owner_id, due_date);

CREATE TABLE IF NOT EXISTS owner_rent_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    charge_id UUID NOT NULL REFERENCES owner_rent_charges(id),
    amount BIGINT NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'mtn_momo', 'airtel_money')),
    reference TEXT NOT NULL DEFAULT '',
    idempotency_key TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS owner_rent_receipts_charge_idx ON owner_rent_receipts(charge_id);

CREATE TABLE IF NOT EXISTS owner_maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES managed_units(id) ON DELETE SET NULL,
    description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_progress', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS owner_maintenance_owner_created_idx ON owner_maintenance_requests(owner_id, created_at DESC);
CREATE TABLE IF NOT EXISTS owner_maintenance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES owner_maintenance_requests(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    next_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS owner_maintenance_events_owner_idx ON owner_maintenance_events(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS owner_onboarding (
    owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    step SMALLINT NOT NULL DEFAULT 1 CHECK (step BETWEEN 1 AND 5),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
