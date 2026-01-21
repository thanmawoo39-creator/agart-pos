import { sqlite } from "./server/lib/db";

async function runManualMigration() {
    console.log("Running Manual Migration...");

    try {
        // Staff table
        const staffInfo = sqlite.prepare("PRAGMA table_info(staff)").all() as any[];
        const hasIsGuest = staffInfo.some(c => c.name === 'is_guest');

        if (!hasIsGuest) {
            console.log("Adding is_guest to staff...");
            sqlite.prepare("ALTER TABLE staff ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0").run();
            console.log("✅ is_guest added.");
        } else {
            console.log("is_guest already exists.");
        }

        // Sales table
        const salesInfo = sqlite.prepare("PRAGMA table_info(sales)").all() as any[];
        const hasPhoneVerified = salesInfo.some(c => c.name === 'phone_verified');
        const hasGuestId = salesInfo.some(c => c.name === 'guest_id');

        if (!hasPhoneVerified) {
            console.log("Adding phone_verified to sales...");
            sqlite.prepare("ALTER TABLE sales ADD COLUMN phone_verified INTEGER DEFAULT 0").run();
            console.log("✅ phone_verified added.");
        }

        if (!hasGuestId) {
            console.log("Adding guest_id to sales...");
            sqlite.prepare("ALTER TABLE sales ADD COLUMN guest_id TEXT").run();
            console.log("✅ guest_id added.");
        }

        console.log("Manual migration complete.");
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

runManualMigration();
