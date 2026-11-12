-- Landlord accounts have no free tier. The first time a landlord opens the
-- workspace they receive one Silver trial; after it ends the workspace is
-- locked until they pay for a plan. Additive only.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- One row per landlord who has received (or is not eligible for) the trial.
-- The primary key guarantees a trial is never granted twice.
CREATE TABLE IF NOT EXISTS landlord_trials (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    -- 'granted' = trial created; 'skipped' = landlord already had a paid plan.
    outcome TEXT NOT NULL CHECK (outcome IN ('granted', 'skipped')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (key, value) VALUES ('landlord_trial_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;
