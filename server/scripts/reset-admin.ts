import { db } from '../lib/db';
import { staff } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashPin } from '../lib/auth';

async function resetAdmin() {
  console.log('🔄 Resetting Admin user...');

  try {
    // Step 1: Check for existing admin users
    const existingAdmins = await db.select().from(staff).where(eq(staff.name, 'Admin'));

    const pin = '1234';
    const hashedPin = hashPin(pin);

    if (existingAdmins.length > 0) {
      // Update existing admin with hashed PIN (avoid foreign key issues)
      console.log(`Found ${existingAdmins.length} existing admin user(s), updating PIN...`);

      const [updatedAdmin] = await db.update(staff)
        .set({
          pin: hashedPin,
          role: 'owner',
          status: 'active'
        })
        .where(eq(staff.name, 'Admin'))
        .returning();

      console.log('✅ SUCCESS: Admin PIN updated');
      console.log('   Name:', updatedAdmin.name);
      console.log('   PIN:', pin);
      console.log('   Role:', updatedAdmin.role);
      console.log('   ID:', updatedAdmin.id);
      console.log(`\n🎉 You can now login with PIN: ${pin}`);
    } else {
      // Create new admin user with hashed pin
      console.log('No existing admin found, creating new admin...');

      const [newAdmin] = await db.insert(staff).values({
        name: 'Admin',
        pin: hashedPin,
        role: 'owner',
        status: 'active',
        barcode: null,
      }).returning();

      console.log('✅ SUCCESS: Admin user created');
      console.log('   Name:', newAdmin.name);
      console.log('   PIN:', pin);
      console.log('   Role:', newAdmin.role);
      console.log('   ID:', newAdmin.id);
      console.log(`\n🎉 You can now login with PIN: ${pin}`);
    }

  } catch (error) {
    console.error('❌ Error resetting admin:', error);
    throw error;
  }
}

resetAdmin();
