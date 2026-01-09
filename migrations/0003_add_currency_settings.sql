-- Migration: Add currency settings to app_settings table
-- Date: 2026-01-08
-- Description: Adds currency configuration fields for customizable price display

ALTER TABLE app_settings ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'MMK';
ALTER TABLE app_settings ADD COLUMN currency_symbol TEXT NOT NULL DEFAULT 'K';
ALTER TABLE app_settings ADD COLUMN currency_position TEXT NOT NULL DEFAULT 'after';
