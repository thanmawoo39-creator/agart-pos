import { db } from "./db";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

(async () => {
	try {
		console.log('Starting database migration...');
		await migrate(db, { migrationsFolder: "./migrations" });
		console.log('✅ Database migration completed successfully!');
	} catch (err: any) {
		console.error('❌ Migration error:', err);
		throw err;
	}
})();