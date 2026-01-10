
import { db } from './server/db';
import { sessions } from './schema';

async function clearSessions() {
  try {
    console.log("Clearing all session cookies...");
    await db.delete(sessions);
    console.log("All session cookies cleared successfully.");
  } catch (error) {
    console.error("Error clearing session cookies:", error);
  }
}

clearSessions();
