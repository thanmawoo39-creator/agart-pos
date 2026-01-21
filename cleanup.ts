
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { staff } from './shared/schema';
import { eq, like, or } from 'drizzle-orm';

// Connect to DB
const sqlite = new Database('database.sqlite');
const db = drizzle(sqlite);

async function cleanup() {
    console.log('🧹 Starting Nuclear Cleanup...');

    try {
        // 1. Delete by Name (Guest/Test)
        const nameResult = db.delete(staff)
            .where(or(
                like(staff.name, '%Guest%'),
                like(staff.name, '%Test%'),
                like(staff.name, '%Customer%')
            ))
            .run();
        console.log(`❌ Deleted ${nameResult.changes} users with 'Guest'/'Test'/'Customer' in name.`);

        // 2. Delete by Role (Customer)
        const roleResult = db.delete(staff)
            .where(eq(staff.role, 'customer'))
            .run();
        console.log(`❌ Deleted ${roleResult.changes} users with 'customer' role.`);

        console.log('✅ Cleanup complete. The database has been purged.');
    } catch (error) {
        console.error('Failed to cleanup:', error);
    }
}

cleanup();
