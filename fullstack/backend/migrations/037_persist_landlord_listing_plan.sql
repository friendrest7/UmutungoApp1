ALTER TABLE listing_subscriptions
    ADD COLUMN plan_key TEXT NOT NULL DEFAULT ''
    CHECK (plan_key IN ('', 'silver', 'gold', 'platinum'));
