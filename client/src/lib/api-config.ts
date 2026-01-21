/**
 * Environment-Aware API Configuration
 *
 * Priority Order:
 * 1. VITE_API_URL environment variable (set in .env files)
 * 2. Development mode: Use Vite proxy (empty string for relative paths)
 * 3. Capacitor/Android: Use configured production URL
 * 4. Fallback: localhost:5000
 */

// Detect if running inside Capacitor (Android/iOS)
const isCapacitor = (): boolean => {
  return typeof window !== 'undefined' &&
    (window as any).Capacitor !== undefined;
};

// Detect if running in development mode
const isDevelopment = (): boolean => {
  return import.meta.env.DEV === true;
};

// Get the appropriate API base URL
const getApiBaseUrl = (): string => {
  // 1. Explicit environment variable takes highest priority
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 2. Development mode with Vite - use proxy (relative paths)
  if (isDevelopment() && !isCapacitor()) {
    return ''; // Empty string = relative paths, handled by Vite proxy
  }

  // 3. Capacitor (Android/iOS) - must use absolute URL
  if (isCapacitor()) {
    // In production Capacitor builds, VITE_API_URL should be set
    // Fallback to localhost for development testing
    console.warn('[API Config] Running in Capacitor without VITE_API_URL. Using localhost fallback.');
    return 'http://10.0.2.2:5000'; // Android emulator localhost
  }

  // 4. Production web build without explicit URL
  if (import.meta.env.PROD) {
    // In production, API should be on same origin or VITE_API_URL should be set
    return ''; // Same origin
  }

  // 5. Ultimate fallback
  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();

// Export utilities for debugging
export const apiConfig = {
  baseUrl: API_BASE_URL,
  isCapacitor: isCapacitor(),
  isDevelopment: isDevelopment(),
  envUrl: import.meta.env.VITE_API_URL || null,
};

// Log configuration in development for debugging
if (isDevelopment()) {
  console.log('[API Config]', apiConfig);
}
