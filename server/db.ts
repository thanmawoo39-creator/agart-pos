import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@shared/schema";

import path from "path";

const dbPath = process.env.NODE_ENV === "production"
    ? path.resolve("/data/database.sqlite")
    : "database.sqlite";

export const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });