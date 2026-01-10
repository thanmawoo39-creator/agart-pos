import { db } from '../lib/db';
import { staff } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import { hashPin } from '../lib/auth';

async function resetAdmin4Digit() {
  console.log('🔄 Resetting Admin user to 4-digit PIN...');

  try {
    // Step 1: Delete existing admin user(s)
    console.log("Deleting existing admin/owner users...");
    await db.delete(staff).where(or(eq(staff.role, 'owner'), eq(staff.name, 'admin')));
    console.log("Existing admin user(s) deleted.");

    // Step 2: Create new admin user with 4-digit PIN
    const pin = '1234';
    const hashedPin = hashPin(pin);
    
    console.log(`Generated Hash for PIN '1234': ${hashedPin}`);

    console.log("Creating new admin user...");
    const [newAdmin] = await db.insert(staff).values({
        name: 'admin',
        role: 'owner',
        pin: hashedPin,
        status: 'active',
    }).returning();

    console.log('✅ SUCCESS: Admin user recreated with 4-digit PIN');
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

resetAdmin4Digit();
