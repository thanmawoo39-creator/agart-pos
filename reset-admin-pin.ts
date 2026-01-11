import Database from 'better-sqlite3';
import { hashPin } from './server/lib/auth';

async function resetAdminPin() {
  console.log('🔄 Resetting admin PIN...');

  try {
    const db = new Database('database.sqlite');
    
    // Get existing admin
    const existingAdmin = db.prepare("SELECT * FROM staff WHERE name = 'Admin' OR role = 'owner'").get() as any;
    
    if (existingAdmin) {
      console.log('Found existing admin:', existingAdmin.name, existingAdmin.id);
      
      // Update PIN to 1234
      const newPin = '1234';
      const hashedPin = hashPin(newPin);
      
      db.prepare("UPDATE staff SET pin = ? WHERE id = ?").run(hashedPin, existingAdmin.id);
      
      console.log('✅ Admin PIN updated successfully');
      console.log('   Name:', existingAdmin.name);
      console.log('   New PIN:', newPin);
      console.log('   Role:', existingAdmin.role);
      
    } else {
      console.log('No admin found, creating new one...');
      
      const pin = '1234';
      const hashedPin = hashPin(pin);
      const adminId = crypto.randomUUID();
      
      db.exec(`
        INSERT INTO staff (id, name, pin, role, status)
        VALUES ('${adminId}', 'Admin', '${hashedPin}', 'owner', 'active')
      `);
      
      console.log('✅ New admin created');
      console.log('   Name: Admin');
      console.log('   PIN:', pin);
      console.log('   Role: owner');
    }
    
    // Verify the update
    const admin = db.prepare("SELECT * FROM staff WHERE name = 'Admin' OR role = 'owner'").get() as any;
    console.log('\n🔍 Verification:');
    console.log('   Admin exists:', !!admin);
    console.log('   Name:', admin?.name);
    console.log('   Role:', admin?.role);
    console.log('   Status:', admin?.status);
    
    // Test PIN verification
    const { verifyPin } = await import('./server/lib/auth');
    const isValid = verifyPin('1234', admin.pin);
    console.log('   PIN verification (1234):', isValid ? '✅ PASS' : '❌ FAIL');
    
    console.log(`\n🎉 You can now login with username 'Admin' and PIN: 1234`);
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

resetAdminPin();
