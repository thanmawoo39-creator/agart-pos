import { db } from '../lib/db';
import { staff } from '../../shared/schema';
import { eq, or, sql } from 'drizzle-orm';
import { hashPin } from '../lib/auth';

async function resetAdmin() {
  console.log('🔄 Forcefully resetting Admin user...');

  try {
    // Check if staff table exists using PostgreSQL information_schema
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'staff'
    `);
    const staffTableExists = (result as any).rows?.length > 0;

    if (!staffTableExists) {
      console.log('❌ Staff table does not exist. Please run database migration first.');
      process.exit(1);
    }

    // Step 1: Delete existing admin user(s) to ensure a clean slate.
    console.log("Deleting existing admin/owner users...");
    await db.delete(staff).where(or(eq(staff.role, 'owner'), eq(staff.name, 'admin')));
    console.log("Existing admin user(s) deleted.");

    // Step 2: Create a new admin user.
    const pin = '123456';
    const hashedPin = hashPin(pin);

    console.log(`Generated Hash for PIN '123456': ${hashedPin}`);

    console.log("Creating new admin user...");
    const [newAdmin] = await db.insert(staff).values({
        name: 'admin',
        role: 'owner',
        pin: hashedPin,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }).returning();

    console.log('✅ SUCCESS: Admin user recreated');
    console.log('   Name:', newAdmin.name);
    console.log('   PIN:', pin);
    console.log('   Role:', newAdmin.role);
    console.log('   ID:', newAdmin.id);
    console.log(`\n🎉 You can now login with username 'admin' and PIN: ${pin}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting admin:', error);
    process.exit(1);
  }
}

resetAdmin();
