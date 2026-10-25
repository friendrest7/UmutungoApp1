UPDATE listings
SET description = CASE
    WHEN title ILIKE 'Banquet hall in %' THEN
        'Banquet hall in ' || district || ', suited to celebrations, conferences, and community events. Contact the owner to confirm capacity, facilities, available dates, and rental terms.'
    WHEN title ILIKE 'Event venue in %' THEN
        'Event venue in ' || district || ' for private and community gatherings. Contact the owner to confirm capacity, available facilities, dates, and pricing.'
    WHEN title ILIKE 'Event table setup in %' THEN
        'Event table setup available in ' || district || '. Contact the owner to confirm the number of tables, included items, condition, and availability.'
    WHEN title ILIKE 'Restaurant fixtures in %' THEN
        'Restaurant fixtures in ' || district || '. Contact the owner to confirm the included equipment, condition, and collection or delivery arrangements.'
    ELSE description
END
WHERE owner_id = '00000000-0000-4000-8000-00000000d001'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(tags) AS tag(value)
    WHERE tag.value LIKE 'umutungo-fixture:test-other-%'
      AND tag.value NOT IN ('umutungo-fixture:test-other-5', 'umutungo-fixture:test-other-10')
  )
  AND title ILIKE ANY (ARRAY[
    'Banquet hall in %',
    'Event venue in %',
    'Event table setup in %',
    'Restaurant fixtures in %'
  ]);
