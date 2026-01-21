/**
 * Development server entry point
 * This file sets up Vite HMR for development mode
 * For production, use server/index.ts directly via "npm start"
 */

import 'dotenv/config';

// Set development environment
process.env.NODE_ENV = 'development';

// Import and run the main server
// The server will detect development mode and we'll add Vite middleware here
import('./index.js').catch(console.error);
