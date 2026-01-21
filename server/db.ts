import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use DATABASE_URL environment variable for PostgreSQL connection
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.warn("⚠️ DATABASE_URL not set. Database connection may fail.");
}

export const pool = new Pool({
    connectionString: connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, { schema });
