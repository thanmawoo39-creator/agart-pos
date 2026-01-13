-- Add business_unit_id to products table (Fixed column name from businessUnit_id to business_unit_id)
ALTER TABLE products ADD COLUMN business_unit_id TEXT DEFAULT 'Grocery';

-- Add business_unit_id to sales table
ALTER TABLE sales ADD COLUMN business_unit_id TEXT DEFAULT 'Grocery';

-- Insert sample tables for Restaurant mode (Table creation handled in 0001)
INSERT OR IGNORE INTO tables (id, number, capacity, status, business_unit_id) VALUES
  ('1', '1', 4, 'available', 'Restaurant'),
  ('2', '2', 4, 'occupied', 'Restaurant'),
  ('3', '3', 6, 'available', 'Restaurant'),
  ('4', '4', 2, 'reserved', 'Restaurant'),
  ('5', '5', 8, 'available', 'Restaurant'),
  ('6', '6', 4, 'occupied', 'Restaurant');