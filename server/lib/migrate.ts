import { db } from "./db";
import { migrate } from "drizzle-orm/node-postgres/migrator";

(async () => {
	try {
		console.log('Starting PostgreSQL database migration...');
		await migrate(db, { migrationsFolder: "./migrations" });
		console.log('✅ Database migration completed successfully!');
	} catch (err: any) {
		console.error('❌ Migration error:', err);
		throw err;
	}
})();
