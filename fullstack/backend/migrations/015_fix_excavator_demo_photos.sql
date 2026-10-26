-- Keep the Rusizi excavator listing's gallery focused on the excavator.
DELETE FROM listing_media m
USING listings l
WHERE m.listing_id = l.id
  AND l.tags @> '["umutungo-fixture:test-equipment-7"]'::jsonb
  AND l.owner_id = '00000000-0000-4000-8000-00000000d001'
  AND l.deleted_at IS NULL;

INSERT INTO listing_media (listing_id, media_type, url, sort_order)
SELECT l.id, 'photo', '/properties/equipment-demo-07.jpg', 0
FROM listings l
WHERE l.tags @> '["umutungo-fixture:test-equipment-7"]'::jsonb
  AND l.owner_id = '00000000-0000-4000-8000-00000000d001'
  AND l.deleted_at IS NULL;
