import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

// Fix updated_at columns
const tables = ['staff', 'products', 'customers'];

for (const table of tables) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT DEFAULT '2024-01-01 00:00:00'`);
    console.log(`✅ Added updated_at to ${table}`);
  } catch (e: any) {
    if (e.message.includes('duplicate column name')) {
      console.log(`ℹ️ updated_at already exists in ${table}`);
    } else {
      console.log(`⚠️ Error adding updated_at to ${table}:`, e.message);
    }
  }
}

db.close();
console.log('🎉 Updated_at columns fix completed');
