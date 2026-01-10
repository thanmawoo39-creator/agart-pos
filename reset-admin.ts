
import { db } from './server/db';
import { users } from './schema';
import { eq, or } from 'drizzle-orm';

async function resetAdmin() {
  try {
    console.log("Deleting existing admin user...");
    await db.delete(users).where(or(eq(users.username, 'admin'), eq(users.role, 'owner')));
    console.log("Admin user deleted successfully.");
  } catch (error) {
    console.error("Error deleting admin user:", error);
  }
}

resetAdmin();
