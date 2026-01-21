import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";

import fs from "fs";
import path from "path";

// Ensure /data directory exists in production
if (process.env.NODE_ENV === "production") {
    if (!fs.existsSync("/data")) {
        fs.mkdirSync("/data", { recursive: true });
    }
}

const dbPath = process.env.NODE_ENV === "production"
    ? "/data/database.sqlite"
    : "database.sqlite";

export const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });