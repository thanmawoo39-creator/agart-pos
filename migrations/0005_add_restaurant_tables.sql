-- Migration: Add restaurant tables and table number to sales
-- Created: 2026-01-15

-- Create restaurant_tables table for QR menu management
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id TEXT PRIMARY KEY,
  table_number TEXT NOT NULL UNIQUE,
  table_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add table_number column to sales table
ALTER TABLE sales ADD COLUMN table_number TEXT;

-- Create index for faster table number lookups
CREATE INDEX IF NOT EXISTS idx_sales_table_number ON sales(table_number);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_active ON restaurant_tables(is_active);
