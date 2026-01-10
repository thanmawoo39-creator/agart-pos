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

  // Create app_settings table if it doesn't exist
  const appSettingsExists = tables.some(t => t.name === 'app_settings');
  if (!appSettingsExists) {
    console.log('🔧 Creating app_settings table...');
    db.exec(`
      CREATE TABLE app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ app_settings table created');
  }

  // Insert default app settings
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

  const insertSetting = db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)");
  defaultSettings.forEach(([key, value]) => {
    insertSetting.run(key, value);
    console.log(`✅ Set ${key}: ${value}`);
  });

  // Check if customers table exists and add member_id column if missing
  const customersExists = tables.some(t => t.name === 'customers');
  if (customersExists) {
    const columns = db.prepare("PRAGMA table_info(customers)").all();
    const hasMemberId = columns.some(col => col.name === 'member_id');
    
    if (!hasMemberId) {
      console.log('🔧 Adding member_id column to customers table...');
      db.exec("ALTER TABLE customers ADD COLUMN member_id TEXT");
      
      // Create unique index on member_id
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS customers_member_id_unique ON customers(member_id)");
      console.log('✅ member_id column added to customers table');
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
