UPDATE listings
SET monthly_fee = ROUND(price * CASE
    WHEN price <= 300000 THEN 0.01
    WHEN price <= 1000000 THEN 0.02
    WHEN price <= 10000000 THEN 0.03
    WHEN price <= 30000000 THEN 0.031
    WHEN price <= 100000000 THEN 0.032
    ELSE 0.012
END, 2)
WHERE price > 0;
