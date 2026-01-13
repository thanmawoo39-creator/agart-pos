import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../shared/schema';

// Initialize SQLite database (must match drizzle.config.ts)
export const sqlite = new Database('database.sqlite');

// Initialize Drizzle ORM
export const db = drizzle(sqlite, { schema });