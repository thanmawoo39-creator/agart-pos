
import { db } from "./server/lib/db";
import { sql } from "drizzle-orm";

async function runMigration() {
    console.log("Starting migration...");

    try {
        // 1. Add column if not exists
        console.log("Adding origin_unit column...");
        await db.run(sql`ALTER TABLE customers ADD COLUMN origin_unit TEXT REFERENCES business_units(id)`);
        console.log("Column added successfully.");
    } catch (error: any) {
        if (error.message.includes("duplicate column name")) {
            console.log("Column origin_unit already exists.");
        } else {
            console.error("Error adding column:", error);
        }
    }

    try {
        // 2. Backfill existing customers
        console.log("Backfilling origin_unit...");

        // Strategy: 
        // If business_unit_id is present, use it.
        // If not, default to '1' (Grocery/Main Store) as per requirement context usually.
        // However, let's just copy business_unit_id for now.

        const result = await db.run(sql`
      UPDATE customers 
      SET origin_unit = COALESCE(business_unit_id, '1') 
      WHERE origin_unit IS NULL
    `);

        console.log("Backfill complete.", result);
    } catch (error) {
        console.error("Error backfilling:", error);
    }

    console.log("Migration finished.");
}

runMigration();
