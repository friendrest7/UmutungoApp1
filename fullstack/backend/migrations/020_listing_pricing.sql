ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS price_range TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(14,2) NOT NULL DEFAULT 0;

UPDATE listings
SET price_range = CASE
        WHEN price <= 300000 THEN '0-300000'
        WHEN price <= 1000000 THEN '300000-1000000'
        WHEN price <= 10000000 THEN '1000000-10000000'
        WHEN price <= 30000000 THEN '10000000-30000000'
        WHEN price <= 100000000 THEN '30000000-100000000'
        ELSE '100000000-plus'
    END,
    monthly_fee = ROUND(price * CASE
        WHEN price <= 300000 THEN 0.01
        WHEN price <= 1000000 THEN 0.02
        WHEN price <= 10000000 THEN 0.03
        WHEN price <= 30000000 THEN 0.03
        WHEN price <= 100000000 THEN 0.03
        ELSE 0.01
    END, 2)
WHERE price > 0;
