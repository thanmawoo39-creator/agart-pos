import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

// Try to add created_at column if it doesn't exist
try {
  db.exec("ALTER TABLE staff ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  console.log('✅ Added created_at to staff');
} catch (e: any) {
  if (e.message.includes('duplicate column name')) {
    console.log('ℹ️ created_at already exists in staff');
  } else {
    console.log('⚠️ Error adding created_at to staff:', e.message);
  }
}

try {
  db.exec("ALTER TABLE products ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  console.log('✅ Added created_at to products');
} catch (e: any) {
  if (e.message.includes('duplicate column name')) {
    console.log('ℹ️ created_at already exists in products');
  } else {
    console.log('⚠️ Error adding created_at to products:', e.message);
  }
}

try {
  db.exec("ALTER TABLE customers ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  console.log('✅ Added created_at to customers');
} catch (e: any) {
  if (e.message.includes('duplicate column name')) {
    console.log('ℹ️ created_at already exists in customers');
  } else {
    console.log('⚠️ Error adding created_at to customers:', e.message);
  }
}

try {
  db.exec("ALTER TABLE sales ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  console.log('✅ Added created_at to sales');
} catch (e: any) {
  if (e.message.includes('duplicate column name')) {
    console.log('ℹ️ created_at already exists in sales');
  } else {
    console.log('⚠️ Error adding created_at to sales:', e.message);
  }
}

try {
  db.exec("ALTER TABLE credit_ledger ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  console.log('✅ Added created_at to credit_ledger');
} catch (e: any) {
  if (e.message.includes('duplicate column name')) {
    console.log('ℹ️ created_at already exists in credit_ledger');
  } else {
    console.log('⚠️ Error adding created_at to credit_ledger:', e.message);
  }
}

// Verify admin user
const admin = db.prepare("SELECT * FROM staff WHERE name = 'Admin'").get();
console.log('👤 Admin user:', admin ? '✅ Found' : '❌ Not found');

db.close();
console.log('🎉 Database fix completed');
