
import { db } from "../server/lib/db";
import { sql } from "drizzle-orm";

async function verifyWipe() {
    console.log("🔍 VERIFYING DATABASE WIPE...");

    const tables = [
        'customers',
        'sales',
        'inventory_logs',
        'attendance',
        'shifts',
        'catering_orders',
        'credit_ledger'
    ];

    let totalErrors = 0;

    for (const table of tables) {
        const result = await db.run(sql.raw(`SELECT count(*) as count FROM ${table}`));
        // better-sqlite3 returns array of result objects or singular? Drizzle .run returns result info.
        // Use .get() or .all() with raw sqlite for counts usually, or drizzle query.
        // Let's use sql`` with .get() if possible or standard drizzle query.
        // Since we want raw dynamic table names, raw is easiest.
        // Drizzle's .get() might not be available on 'run'.
        // Let's use `db.all(sql.raw(...))` equivalent? Drizzle `db.run` is for exec. `db.get` returns one.
    }

    // Easier: Use the better-sqlite3 instance directly if exposed, or just specific queries.
    // Actually, let's just use specific queries for safety.

    const counts = {
        customers: (await db.run(sql`SELECT count(*) as c FROM customers`)).rows[0].c, // Wait, .run in drizzle-orm/better-sqlite3 returns RunResult, not rows for SELECT?
        // Drizzle with better-sqlite3: 
        // db.select({ count: sql`count(*)` }).from(customers) ...
        // Let's use standard drizzle.
    };

    // Re-writing to use standard Drizzle queries where possible or try-catch raw.
    // Actually, I'll just use the raw sqlite instance from `server/lib/db.ts`?
    // It exports `sqlite` as `export const sqlite = new Database(...)`.
}

// SIMPLIFIED VERSION USING DIRECT SQLITE IMPORT
import { sqlite } from "../server/lib/db";

console.log("🔍 CHECKING ROW COUNTS:");

const tablesToCheck = [
    'customers',
    'sales',
    'sale_items',
    'inventory_logs',
    'attendance',
    'shifts',
    'catering_orders',
    'credit_ledger',
    'staff'
];

tablesToCheck.forEach(table => {
    try {
        const row = sqlite.prepare(`SELECT count(*) as count FROM ${table}`).get() as { count: number };
        console.log(`- ${table}: ${row.count} rows`);
    } catch (e) {
        console.log(`- ${table}: ERROR (Table might not exist)`);
    }
});

console.log("✅ Verification Complete.");
