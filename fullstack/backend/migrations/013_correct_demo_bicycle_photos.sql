-- Remove the bicycle photo from venue and other non-bicycle demo listings.
DELETE FROM listing_media AS media
USING listings AS listing
WHERE media.listing_id = listing.id
  AND listing.owner_id = '00000000-0000-4000-8000-00000000d001'
  AND media.url = '/properties/other-demo-06.jpg'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(listing.tags) AS tag(value)
    WHERE tag.value LIKE 'umutungo-fixture:test-other-%'
  )
  AND listing.title NOT ILIKE 'City bicycle%';

-- The generated bicycle cards should only show the bicycle photo, not venue
-- photos from the shared Other category rotation.
DELETE FROM listing_media AS media
USING listings AS listing
WHERE media.listing_id = listing.id
  AND listing.owner_id = '00000000-0000-4000-8000-00000000d001'
  AND listing.title ILIKE 'City bicycle%'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(listing.tags) AS tag(value)
    WHERE tag.value IN ('umutungo-fixture:test-other-5', 'umutungo-fixture:test-other-10')
  );

INSERT INTO listing_media (listing_id, media_type, url, sort_order)
SELECT listing.id, 'photo', '/properties/other-demo-06.jpg', 0
FROM listings AS listing
WHERE listing.owner_id = '00000000-0000-4000-8000-00000000d001'
  AND listing.title ILIKE 'City bicycle%'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(listing.tags) AS tag(value)
    WHERE tag.value IN ('umutungo-fixture:test-other-5', 'umutungo-fixture:test-other-10')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM listing_media AS media
    WHERE media.listing_id = listing.id
      AND media.url = '/properties/other-demo-06.jpg'
  );
