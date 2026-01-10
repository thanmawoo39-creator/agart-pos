import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Fixing database schema...');

const dbPath = path.join(__dirname, 'sqlite.db');
const db = new Database(dbPath);

try {
  // Check current tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📋 Current tables:', tables.map(t => t.name));

  // Check app_settings table structure
  const appSettingsExists = tables.some(t => t.name === 'app_settings');
  if (appSettingsExists) {
    const columns = db.prepare("PRAGMA table_info(app_settings)").all();
    console.log('📋 app_settings columns:', columns.map(c => c.name));
    
    // Check if it has the expected structure
    const hasKeyColumn = columns.some(col => col.name === 'key');
    const hasValueColumn = columns.some(col => col.name === 'value');
    
    if (!hasKeyColumn || !hasValueColumn) {
      console.log('🔧 app_settings table has different structure, checking existing data...');
      const existingData = db.prepare("SELECT * FROM app_settings LIMIT 5").all();
      console.log('📋 Existing app_settings data:', existingData);
      
      // For now, just ensure the table exists with whatever structure it has
      console.log('✅ app_settings table exists with current structure');
    } else {
      console.log('✅ app_settings table has correct structure');
    }
  }

  // Insert default app settings (adapt to existing structure)
  try {
    // Try key-value structure first
    const insertKV = db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)");
    
    const defaultSettings = [
      ['currency_code', 'MMK'],
      ['currency_symbol', 'K'],
      ['currency_position', 'after'],
      ['groq_api_key', ''],
      ['ai_image_recognition_enabled', '0'],
      ['enable_local_ai', '0'],
      ['local_ai_url', ''],
      ['gemini_api_key', ''],
      ['enable_mobile_scanner', '1'],
      ['enable_photo_capture', '1'],
      ['local_ai_model', '']
    ];

    defaultSettings.forEach(([key, value]) => {
      try {
        insertKV.run(key, value);
        console.log(`✅ Set ${key}: ${value}`);
      } catch (err) {
        console.log(`ℹ️  Could not set ${key}: ${err.message}`);
      }
    });
  } catch (err) {
    console.log(`ℹ️  app_settings might have different structure: ${err.message}`);
  }

  // Check if customers table exists and add member_id column if missing
  const customersExists = tables.some(t => t.name === 'customers');
  if (customersExists) {
    const columns = db.prepare("PRAGMA table_info(customers)").all();
    const hasMemberId = columns.some(col => col.name === 'member_id');
    
    if (!hasMemberId) {
      console.log('🔧 Adding member_id column to customers table...');
      db.exec("ALTER TABLE customers ADD COLUMN member_id TEXT");
      
      // Create unique index on member_id
      try {
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS customers_member_id_unique ON customers(member_id)");
        console.log('✅ member_id column and index added to customers table');
      } catch (err) {
        console.log(`ℹ️  Index creation: ${err.message}`);
      }
    } else {
      console.log('✅ customers table already has member_id column');
    }
  }

  // Check sales table structure
  const salesExists = tables.some(t => t.name === 'sales');
  if (salesExists) {
    const columns = db.prepare("PRAGMA table_info(sales)").all();
    const hasItems = columns.some(col => col.name === 'items');
    
    if (!hasItems) {
      console.log('🔧 Adding items column to sales table...');
      db.exec("ALTER TABLE sales ADD COLUMN items TEXT");
      console.log('✅ items column added to sales table');
    } else {
      console.log('✅ sales table already has items column');
    }
  }

  // Check staff table and ensure admin with PIN 1234
  const staffExists = tables.some(t => t.name === 'staff');
  if (staffExists) {
    const adminUser = db.prepare("SELECT * FROM staff WHERE role = 'admin' OR role = 'owner' LIMIT 1").get();
    
    if (adminUser) {
      console.log('👤 Found admin user:', adminUser.name);
      
      // Update admin PIN to 1234 (hashed)
      const crypto = await import('node:crypto');
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPin = crypto.scryptSync('1234', salt, 64).toString('hex');
      const pinHash = `${salt}:${hashedPin}`;
      
      db.prepare("UPDATE staff SET pin = ? WHERE id = ?").run(pinHash, adminUser.id);
      console.log('✅ Admin PIN updated to 1234');
    } else {
      console.log('👤 Creating admin user...');
      const crypto = await import('node:crypto');
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPin = crypto.scryptSync('1234', salt, 64).toString('hex');
      const pinHash = `${salt}:${hashedPin}`;
      
      db.prepare(`
        INSERT INTO staff (name, pin, role, status, barcode) 
        VALUES (?, ?, ?, ?, ?)
      `).run('Admin', pinHash, 'admin', 'active', 'ADMIN001');
      console.log('✅ Admin user created with PIN 1234');
    }
  }

  console.log('🎯 Database schema fixes complete!');
  
} catch (error) {
  console.error('❌ Error fixing database:', error);
} finally {
  db.close();
}
