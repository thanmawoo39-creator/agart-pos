import { db } from '../lib/db';
import { staff } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { hashPin } from '../lib/auth';

async function createStaffAndAdmin() {
  console.log('🔄 Creating admin user...');

  try {
    // Delete existing admin users
    console.log("Deleting existing admin users...");
    await db.delete(staff).where(eq(staff.role, 'owner'));

    // Create new admin user with 4-digit PIN
    const pin = '1234';
    const hashedPin = hashPin(pin);

    console.log(`Creating admin user with PIN '1234'...`);
    const adminId = crypto.randomUUID();

    const [admin] = await db.insert(staff).values({
      id: adminId,
      name: 'admin',
      pin: hashedPin,
      role: 'owner',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    console.log('✅ SUCCESS: Admin user created');
    console.log('   Name:', admin.name);
    console.log('   PIN:', pin);
    console.log('   Role:', admin.role);
    console.log('   ID:', admin.id);
    console.log(`\n🎉 You can now login with username 'admin' and PIN: ${pin}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createStaffAndAdmin();
