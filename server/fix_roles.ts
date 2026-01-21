
import { db } from "./lib/db";
import { staff } from "../shared/schema";
import { eq, like, or, and, inArray } from "drizzle-orm";

async function main() {
    console.log("Fixing roles...");

    // 1. Fix isGuest=true users who are 'cashier'
    try {
        const res1 = await db.update(staff)
            .set({ role: 'customer' })
            .where(and(eq(staff.isGuest, true), eq(staff.role, 'cashier')))
            .run();
        console.log(`Updated ${res1.changes} guest users.`);
    } catch (e) {
        console.error("Error updating guest users:", e);
    }

    // 2. Fix users with 'Guest' or 'Test' in name
    try {
        const res2 = await db.update(staff)
            .set({ role: 'customer' })
            .where(and(
                or(
                    like(staff.name, '%Guest%'),
                    like(staff.name, '%Test%'),
                    like(staff.name, '%Guess%'),
                    like(staff.name, '%Customer%')
                ),
                eq(staff.role, 'cashier')
            ))
            .run();
        console.log(`Updated ${res2.changes} Guest/Test named users.`);
    } catch (e) {
        console.error("Error updating named users:", e);
    }

    // 3. Fix specific known bad records found in logs
    const badNames = ['Me', 'A', 'B', 'C', 'Than Mawoo', 'အစမ်း', 'ကိုကို', 'စစ'];
    try {
        const res3 = await db.update(staff)
            .set({ role: 'customer' })
            .where(and(
                inArray(staff.name, badNames),
                eq(staff.role, 'cashier')
            ))
            .run();
        console.log(`Updated ${res3.changes} known bad named users.`);
    } catch (e) {
        console.error("Error updating specific list:", e);
    }

    // 4. Broad Myanmar/Karen character sweep
    // Fetch all 'cashier' users, check name regex, update.
    try {
        const cashiers = await db.select().from(staff).where(eq(staff.role, 'cashier')).all();
        let count = 0;
        for (const c of cashiers) {
            // Check for Myanmar characters (u1000-u109F) or key specific names
            if (/[\u1000-\u109F\uAA60-\uAA7F]/.test(c.name)) {
                console.log(`Detected Myanmar/Karen name with cashier role: ${c.name}, converting to customer...`);
                await db.update(staff).set({ role: 'customer' }).where(eq(staff.id, c.id)).run();
                count++;
            }
        }
        console.log(`Updated ${count} Myanmar/Karen named users.`);
    } catch (e) {
        console.error("Error updating regex matches:", e);
    }
}

main().catch(console.error).finally(() => process.exit(0));
