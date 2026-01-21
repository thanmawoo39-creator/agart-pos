
import { db } from "./server/lib/db";
import { sql } from "drizzle-orm";

async function checkSchema() {
    try {
        const result = await db.run(sql`PRAGMA table_info(customers)`);
        console.log("Customers Table Schema:", JSON.stringify(result, null, 2));
        // Check if origin_unit exists
        // The result from PRAGMA table_info is usually an array of objects
        // depending on the driver, but typically has column names.
        // Drizzle's db.run might return differently depending on the driver setup.
        // Let's print checking specifically.

        // Actually, better to just try selecting the column, if it fails, it fails.
        // But let's stick to table_info for safety.
    } catch (err) {
        console.error("Error checking schema:", err);
    }
}

checkSchema();
