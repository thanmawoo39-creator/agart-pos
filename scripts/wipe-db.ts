
import { db } from "../server/lib/db";
import { sql } from "drizzle-orm";
import {
    customers,
    sales,
    saleItems,
    inventoryLogs,
    attendance,
    shifts,
    cateringOrders,
    creditLedger
} from "../shared/schema";

async function wipeDatabase() {
    console.log("☢️ STARTING NUCLEAR DATABASE WIPE ☢️");

    try {
        // 1. Disable Foreign Keys
        console.log("1. Disabling Foreign Keys...");
        await db.run(sql`PRAGMA foreign_keys = OFF;`);

        // 2. Truncate Tables
        const tables = [
            'customers',
            'sales',
            'sale_items',
            'inventory_logs',
            'attendance',
            'shifts',
            'catering_orders',
            'credit_ledger'
        ];

        for (const table of tables) {
            console.log(`2. Deleting from ${table}...`);
            await db.run(sql.raw(`DELETE FROM ${table};`));
        }

        // 3. Re-enable Foreign Keys
        console.log("3. Re-enabling Foreign Keys...");
        await db.run(sql`PRAGMA foreign_keys = ON;`);

        console.log("✅ DATABASE WIPE COMPLETED SUCCESSFULLY");
        process.exit(0);
    } catch (error) {
        console.error("❌ WIPE FAILED:", error);
        process.exit(1);
    }
}

wipeDatabase();
