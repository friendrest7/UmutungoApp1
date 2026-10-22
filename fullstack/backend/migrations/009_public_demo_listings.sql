-- Seed a small public property inventory so a newly deployed database has
-- representative listings before owners begin publishing their own.
INSERT INTO users (id, name, email, phone, role, verified_at)
VALUES (
    '00000000-0000-4000-8000-00000000d001',
    'Umutungo Development Komisiyoneri',
    'demo-listings@umutungo.rw',
    '+250780000099',
    'komisiyoneri',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO business_profiles (user_id, business_name)
VALUES ('00000000-0000-4000-8000-00000000d001', 'Umutungo Development')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO listings (
    id, owner_id, category, transaction_type, title, description, price, currency,
    province, district, sector, status, tags, contact_method
)
VALUES
    ('00000000-0000-4000-8000-00000000d101', '00000000-0000-4000-8000-00000000d001', 'house', 'rent_out', 'Family home in Kacyiru', 'Demo family home with three bedrooms near offices and everyday services.', 650000, 'RWF', 'City of Kigali', 'Gasabo', 'Kacyiru', 'published', '["public-demo","demo-house-kacyiru"]', 'message'),
    ('00000000-0000-4000-8000-00000000d102', '00000000-0000-4000-8000-00000000d001', 'apartment', 'rent_out', 'City apartment in Kimihurura', 'Demo city apartment with two bedrooms in a convenient Kigali location.', 850000, 'RWF', 'City of Kigali', 'Gasabo', 'Kimihurura', 'published', '["public-demo","demo-apartment-kimihurura"]', 'message'),
    ('00000000-0000-4000-8000-00000000d103', '00000000-0000-4000-8000-00000000d001', 'land', 'sell', 'Residential plot in Kicukiro', 'Demo residential plot. Confirm boundaries, title documents, zoning, road access, and services with the owner.', 8500000, 'RWF', 'City of Kigali', 'Kicukiro', 'Kicukiro', 'published', '["public-demo","demo-land-kicukiro"]', 'message'),
    ('00000000-0000-4000-8000-00000000d104', '00000000-0000-4000-8000-00000000d001', 'commercial', 'rent_out', 'Commercial space in Kimihurura', 'Demo commercial space with convenient access for customers and teams.', 950000, 'RWF', 'City of Kigali', 'Gasabo', 'Kimihurura', 'published', '["public-demo","demo-commercial-kimihurura"]', 'message'),
    ('00000000-0000-4000-8000-00000000d105', '00000000-0000-4000-8000-00000000d001', 'office', 'rent_out', 'Professional office suite in Kigali CBD', 'Demo office suite for teams seeking a central Kigali workspace.', 600000, 'RWF', 'City of Kigali', 'Nyarugenge', 'Nyarugenge', 'published', '["public-demo","demo-office-cbd"]', 'message'),
    ('00000000-0000-4000-8000-00000000d106', '00000000-0000-4000-8000-00000000d001', 'hospitality', 'book', 'Guest stay in Kigali', 'Demo short stay with booking details available from the owner.', 28000, 'RWF', 'City of Kigali', 'Gasabo', 'Kacyiru', 'published', '["public-demo","demo-stay-kacyiru"]', 'message'),
    ('00000000-0000-4000-8000-00000000d107', '00000000-0000-4000-8000-00000000d001', 'vehicle', 'rent_out', 'Vehicle available in Kigali', 'Demo vehicle listing. Ask the owner for the model year, mileage, condition, and hire terms.', 18000, 'RWF', 'City of Kigali', 'Gasabo', 'Kacyiru', 'published', '["public-demo","demo-vehicle-kigali"]', 'message'),
    ('00000000-0000-4000-8000-00000000d108', '00000000-0000-4000-8000-00000000d001', 'furniture', 'sell', 'Living and dining room furniture', 'Demo furniture listing. Ask about dimensions, materials, condition, delivery, and included pieces.', 85000, 'RWF', 'City of Kigali', 'Gasabo', 'Remera', 'published', '["public-demo","demo-furniture-remera"]', 'message'),
    ('00000000-0000-4000-8000-00000000d109', '00000000-0000-4000-8000-00000000d001', 'appliance', 'sell', 'Refrigerator and washing machine', 'Demo appliance listing. Ask for the brands, model numbers, working condition, and delivery options.', 95000, 'RWF', 'City of Kigali', 'Gasabo', 'Remera', 'published', '["public-demo","demo-appliances-remera"]', 'message')
ON CONFLICT (id) DO NOTHING;

INSERT INTO listing_media (listing_id, media_type, url, sort_order)
VALUES
    ('00000000-0000-4000-8000-00000000d101', 'photo', '/properties/rwanda-house-01.jpg', 0),
    ('00000000-0000-4000-8000-00000000d102', 'photo', '/properties/apartment-01.jpg', 0),
    ('00000000-0000-4000-8000-00000000d103', 'photo', '/properties/land-01.jpg', 0),
    ('00000000-0000-4000-8000-00000000d104', 'photo', '/properties/commercial-01.jpg', 0),
    ('00000000-0000-4000-8000-00000000d105', 'photo', '/properties/office-03.jpg', 0),
    ('00000000-0000-4000-8000-00000000d106', 'photo', '/properties/hospitality-03.jpg', 0),
    ('00000000-0000-4000-8000-00000000d107', 'photo', '/properties/vehicle-01.png', 0),
    ('00000000-0000-4000-8000-00000000d108', 'photo', '/properties/furniture-02.jpg', 0),
    ('00000000-0000-4000-8000-00000000d109', 'photo', '/properties/appliance-demo-06.jpg', 0)
ON CONFLICT DO NOTHING;

INSERT INTO measurements (listing_id, building_size, bedrooms, bathrooms)
VALUES
    ('00000000-0000-4000-8000-00000000d101', 140, 3, 2),
    ('00000000-0000-4000-8000-00000000d102', 90, 2, 1)
ON CONFLICT DO NOTHING;
