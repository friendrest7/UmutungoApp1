ALTER TABLE listings
    DROP CONSTRAINT IF EXISTS listings_transaction_type_check;

ALTER TABLE listings
    ADD CONSTRAINT listings_transaction_type_check
    CHECK (transaction_type IN ('buy', 'sell', 'rent', 'rent_out', 'book', 'both'));
