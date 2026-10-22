-- Add two image-backed property demos so the landing page's desktop grid
-- ends with a full row while the marketplace grows its real inventory.
INSERT INTO listings (
    id, owner_id, category, transaction_type, title, description, price, currency,
    province, district, sector, status, tags, contact_method
)
VALUES
    (
        '00000000-0000-4000-8000-00000000d110',
        '00000000-0000-4000-8000-00000000d001',
        'house', 'rent_out', 'Garden home in Remera',
        'Demo family home with a private garden and convenient access to local services.',
        780000, 'RWF', 'City of Kigali', 'Gasabo', 'Remera', 'published',
        '["public-demo","demo-house-remera"]', 'message'
    ),
    (
        '00000000-0000-4000-8000-00000000d111',
        '00000000-0000-4000-8000-00000000d001',
        'apartment', 'rent_out', 'Bright apartment in Nyarutarama',
        'Demo city apartment with a balcony and access to shops, offices, and restaurants.',
        1100000, 'RWF', 'City of Kigali', 'Gasabo', 'Nyarutarama', 'published',
        '["public-demo","demo-apartment-nyarutarama"]', 'message'
    )
ON CONFLICT (id) DO NOTHING;

INSERT INTO listing_media (listing_id, media_type, url, sort_order)
VALUES
    ('00000000-0000-4000-8000-00000000d110', 'photo', '/properties/rwanda-house-02.jpg', 0),
    ('00000000-0000-4000-8000-00000000d111', 'photo', '/properties/apartment-02.jpg', 0)
ON CONFLICT DO NOTHING;

INSERT INTO measurements (listing_id, building_size, bedrooms, bathrooms)
VALUES
    ('00000000-0000-4000-8000-00000000d110', 165, 4, 3),
    ('00000000-0000-4000-8000-00000000d111', 110, 3, 2)
ON CONFLICT DO NOTHING;
