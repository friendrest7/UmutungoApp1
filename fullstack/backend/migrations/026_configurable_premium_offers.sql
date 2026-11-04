CREATE TABLE IF NOT EXISTS marketplace_premium_offers (
    offer_key TEXT PRIMARY KEY CHECK (offer_key IN ('silver','gold','platinum','diamond')),
    label TEXT NOT NULL,
    price NUMERIC(14,2) NOT NULL CHECK (price > 0),
    duration_days INTEGER NOT NULL CHECK (duration_days >= 0),
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO marketplace_premium_offers(offer_key,label,price,duration_days)
VALUES ('silver','Silver',10000,90),('gold','Gold',20000,180),('platinum','Platinum',30000,365),('diamond','Diamond',100000,0)
ON CONFLICT(offer_key) DO NOTHING;
