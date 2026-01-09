/**
 * API Configuration
 * Centralizes the API base URL to avoid hardcoded localhost references
 */

// Use environment variable if available, otherwise default to empty string (relative path)
// This allows the app to work on any device/network without hardcoded URLs
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
