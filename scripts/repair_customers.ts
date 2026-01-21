
import { db } from "../server/lib/db";
import { sql } from "drizzle-orm";

async function repairCustomers() {
    console.log("🛠️ Starting Customer Data Repair...");

    try {
        // 1. Force Ensure Column Exists
        console.log("Checking schema...");
        try {
            await db.run(sql`ALTER TABLE customers ADD COLUMN origin_unit TEXT`);
            console.log("✅ Added origin_unit column.");
        } catch (e: any) {
            if (e.message.includes("duplicate column")) {
                console.log("Note: origin_unit column already exists.");
            } else {
                console.error("Schema Error:", e.message);
            }
        }

        // 2. Backfill NULL origin_unit with business_unit_id
        console.log("Backfilling missing origin_unit values...");
        const result = await db.run(sql`
      UPDATE customers 
      SET origin_unit = COALESCE(business_unit_id, '1') 
      WHERE origin_unit IS NULL OR origin_unit = ''
    `);

        console.log(`✅ Backfilled ${result.changes} customers.`);

        // 3. Verify
        const check = await db.all(sql`SELECT count(*) as count FROM customers WHERE origin_unit IS NULL`);
        console.log(`Verification: ${check[0].count} customers still have NULL origin_unit.`);

    } catch (error) {
        console.error("❌ Repair failed:", error);
    }
}

repairCustomers();
