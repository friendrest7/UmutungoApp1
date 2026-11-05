ALTER TABLE listing_subscriptions DROP CONSTRAINT IF EXISTS listing_subscriptions_requested_status_check;
ALTER TABLE listing_subscriptions
    ADD CONSTRAINT listing_subscriptions_requested_status_check
    CHECK (requested_status IN ('published', 'scheduled', 'draft'));
