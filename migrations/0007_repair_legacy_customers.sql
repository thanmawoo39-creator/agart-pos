-- Up Migration
UPDATE customers SET origin_unit = '1' WHERE origin_unit IS NULL;
UPDATE customers SET business_unit_id = '1' WHERE business_unit_id IS NULL;
-- Down Migration (No-op as we cannot know which were null before)
