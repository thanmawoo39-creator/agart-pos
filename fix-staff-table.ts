import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

// Fix staff table created_at column with proper default
try {
  // First try to add the column with a simpler default
  db.exec("ALTER TABLE staff ADD COLUMN created_at TEXT DEFAULT '2024-01-01 00:00:00'");
  console.log('✅ Added created_at to staff');
} catch (e: any) {
  if (e.message.includes('duplicate column name')) {
    console.log('ℹ️ created_at already exists in staff');
  } else {
    console.log('⚠️ Error adding created_at to staff:', e.message);
  }
}

// Verify admin user
const admin = db.prepare("SELECT * FROM staff WHERE name = 'Admin'").get();
console.log('👤 Admin user:', admin ? '✅ Found' : '❌ Not found');
if (admin) {
  console.log('   Name:', admin.name);
  console.log('   Role:', admin.role);
  console.log('   Status:', admin.status);
}

db.close();
console.log('🎉 Staff table fix completed');
