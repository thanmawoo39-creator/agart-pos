-- Fix missing created_at columns if they don't exist
-- Use IF NOT EXISTS approach to avoid errors

-- Check and add created_at to products if missing
ALTER TABLE products ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Check and add created_at to customers if missing  
ALTER TABLE customers ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Check and add created_at to sales if missing
ALTER TABLE sales ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Check and add created_at to credit_ledger if missing
ALTER TABLE credit_ledger ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Check and add created_at to staff if missing
ALTER TABLE staff ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
