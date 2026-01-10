
import { db } from './server/db';
import { users } from './schema';
import { hashPin } from './server/lib/auth';

async function createAdmin() {
  try {
    console.log("Creating new admin user...");
    const hashedPassword = hashPin('123456');
    await db.insert(users).values({
      username: 'admin',
      role: 'owner',
      pin: hashedPassword,
      name: 'Admin',
      phone: '1234567890',
      hourlyRate: 0,
      isActive: true,
      
    });
    console.log("Admin user created successfully.");
  } catch (error) {
    console.error("Error creating admin user:", error);
  }
}

createAdmin();
