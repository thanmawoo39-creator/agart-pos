import Database from 'better-sqlite3';
import { verifyPin } from './server/lib/auth';

async function testLogin() {
  console.log('🧪 Testing login functionality...');
  
  try {
    const db = new Database('database.sqlite');
    
    // Get admin user
    const admin = db.prepare("SELECT * FROM staff WHERE name = 'Admin' OR role = 'owner'").get() as any;
    
    if (!admin) {
      console.log('❌ No admin user found');
      return;
    }
    
    console.log('📋 Admin user found:');
    console.log('   ID:', admin.id);
    console.log('   Name:', admin.name);
    console.log('   Role:', admin.role);
    console.log('   Status:', admin.status);
    console.log('   PIN hash:', admin.pin.substring(0, 50) + '...');
    
    // Test PIN verification
    const testPin = '1234';
    console.log('\n🔐 Testing PIN verification...');
    console.log('   Test PIN:', testPin);
    
    const isValid = verifyPin(testPin, admin.pin);
    console.log('   Verification result:', isValid ? '✅ PASS' : '❌ FAIL');
    
    if (!isValid) {
      console.log('\n🔍 Debugging PIN verification...');
      console.log('   Hash contains colon:', admin.pin.includes(':'));
      
      if (admin.pin.includes(':')) {
        const [salt, key] = admin.pin.split(':');
        console.log('   Salt length:', salt?.length || 0);
        console.log('   Key length:', key?.length || 0);
        
        // Test manual verification
        const crypto = require('crypto');
        const hashedBuffer = crypto.scryptSync(testPin, salt, 64);
        const keyBuffer = Buffer.from(key, 'hex');
        const manualVerify = crypto.timingSafeEqual(hashedBuffer, keyBuffer);
        console.log('   Manual verification:', manualVerify ? '✅ PASS' : '❌ FAIL');
      }
    }
    
    // Test storage method directly
    console.log('\n🗄️ Testing storage.getStaffByPin...');
    const { Storage } = await import('./server/storage');
    const storage = new Storage();
    await storage.initialize();
    
    const staffByPin = await storage.getStaffByPin(testPin);
    console.log('   Result:', staffByPin ? '✅ FOUND' : '❌ NOT FOUND');
    if (staffByPin) {
      console.log('   Found staff:', staffByPin.name, staffByPin.role);
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLogin();
