-- Migration: Add AI-related settings and fix schema
ALTER TABLE app_settings ADD COLUMN ai_image_recognition_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN enable_local_ai INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN local_ai_url TEXT;
ALTER TABLE app_settings ADD COLUMN gemini_api_key TEXT;
ALTER TABLE app_settings ADD COLUMN enable_mobile_scanner INTEGER NOT NULL DEFAULT 1;
ALTER TABLE app_settings ADD COLUMN enable_photo_capture INTEGER NOT NULL DEFAULT 1;
ALTER TABLE app_settings ADD COLUMN updatedAt TEXT;
