-- Migration: Add local_ai_model to app_settings
ALTER TABLE app_settings ADD COLUMN local_ai_model TEXT;
