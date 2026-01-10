import Database from 'better-sqlite3';
import { hashPin } from '../lib/auth';

async function createStaffAndAdmin() {
  console.log('🔄 Creating staff table and admin user...');

  try {
    // Direct database connection
    const db = new Database('database.sqlite');
    
    // Create staff table if it doesn't exist
    console.log("Creating staff table...");
    db.exec(`
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pin TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
        barcode TEXT UNIQUE,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended'))
      )
    `);
    
    // Delete existing admin users
    console.log("Deleting existing admin users...");
    db.exec("DELETE FROM staff WHERE name = 'admin' OR role = 'owner'");
    
    // Create new admin user with 4-digit PIN
    const pin = '1234';
    const hashedPin = hashPin(pin);
    
    console.log(`Creating admin user with PIN '1234'...`);
    const adminId = crypto.randomUUID();
    
    db.exec(`
      INSERT INTO staff (id, name, pin, role, status)
      VALUES ('${adminId}', 'admin', '${hashedPin}', 'owner', 'active')
    `);
    
    // Verify creation
    const admin = db.prepare("SELECT * FROM staff WHERE name = 'admin'").get();
    
    console.log('✅ SUCCESS: Admin user created');
    console.log('   Name:', admin.name);
    console.log('   PIN:', pin);
    console.log('   Role:', admin.role);
    console.log('   ID:', admin.id);
    console.log(`\n🎉 You can now login with username 'admin' and PIN: ${pin}`);
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

createStaffAndAdmin();
