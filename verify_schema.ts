import { sqlite } from "./server/lib/db";

async function verifyMigration() {
    console.log("Verifying Database Schema...");

    const staffInfo = sqlite.prepare("PRAGMA table_info(staff)").all() as any[];
    const salesInfo = sqlite.prepare("PRAGMA table_info(sales)").all() as any[];

    const isGuest = staffInfo.find(c => c.name === 'is_guest');
    const phoneVerified = salesInfo.find(c => c.name === 'phone_verified');
    const guestId = salesInfo.find(c => c.name === 'guest_id');

    console.log("Stats:");
    console.log(`- staff.is_guest: ${isGuest ? '✅ FOUND' : '❌ MISSING'}`);
    console.log(`- sales.phone_verified: ${phoneVerified ? '✅ FOUND' : '❌ MISSING'}`);
    console.log(`- sales.guest_id: ${guestId ? '✅ FOUND' : '❌ MISSING'}`);

    if (isGuest && phoneVerified && guestId) {
        console.log("\nAll migrations verified successfully!");
        process.exit(0);
    } else {
        console.error("\nSome migrations are missing. Please restart the server to run migrations.");
        process.exit(1);
    }
}

verifyMigration();
