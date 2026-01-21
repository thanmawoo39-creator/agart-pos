ALTER TABLE customers ADD COLUMN origin_unit TEXT;
UPDATE customers SET origin_unit = business_unit_id WHERE origin_unit IS NULL;
