import { db } from '../lib/db';
import { staff } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { hashPin } from '../lib/auth';

async function resetAdmin() {
  console.log('🔄 Forcefully resetting Admin user...');

  try {
    // Check if staff table exists first
    const tables = await (db as any).prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Available tables:', tables.map((t: any) => t.name));
    
    const staffTableExists = tables.some((t: any) => t.name === 'staff');
    
    if (!staffTableExists) {
      console.log('❌ Staff table does not exist. Please run database migration first.');
      return;
    }

    // Step 1: Delete existing admin user(s) to ensure a clean slate.
    console.log("Deleting existing admin/owner users...");
    const deleteResult = await db.delete(staff).where(or(eq(staff.role, 'owner'), eq(staff.name, 'admin')));
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
    }).returning();

    console.log('✅ SUCCESS: Admin user recreated');
    console.log('   Name:', newAdmin.name);
    console.log('   PIN:', pin);
    console.log('   Role:', newAdmin.role);
    console.log('   ID:', newAdmin.id);
    console.log(`\n🎉 You can now login with username 'admin' and PIN: ${pin}`);

  } catch (error) {
    console.error('❌ Error resetting admin:', error);
    throw error;
  }
}

resetAdmin();
