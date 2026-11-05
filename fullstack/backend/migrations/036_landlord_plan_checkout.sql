ALTER TABLE listing_subscriptions
    DROP CONSTRAINT IF EXISTS listing_subscriptions_rate_percent_check;

ALTER TABLE listing_subscriptions
    ADD CONSTRAINT listing_subscriptions_rate_percent_check
    CHECK (rate_percent >= 0);
