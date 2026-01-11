import Database from 'better-sqlite3';

async function fixDatabaseSchema() {
  console.log('🔧 Fixing database schema issues...');
  
  try {
    const db = new Database('database.sqlite');
    
    // Check current schema for staff table
    console.log('📋 Checking staff table schema...');
    const staffSchema = db.prepare("PRAGMA table_info(staff)").all();
    console.log('Staff columns:', staffSchema.map((col: any) => `${col.name}: ${col.type}`));
    
    // Check if created_at already exists
    const hasCreatedAt = staffSchema.some((col: any) => col.name === 'created_at');
    console.log('Has created_at:', hasCreatedAt);
    
    if (!hasCreatedAt) {
      console.log('➕ Adding created_at column to staff table...');
      db.exec("ALTER TABLE staff ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
      console.log('✅ created_at column added');
    } else {
      console.log('ℹ️ created_at column already exists');
    }
    
    // Check other critical tables
    const tables = ['products', 'customers', 'sales', 'credit_ledger', 'attendance'];
    
    for (const table of tables) {
      try {
        console.log(`📋 Checking ${table} table schema...`);
        const schema = db.prepare(`PRAGMA table_info(${table})`).all();
        console.log(`${table} columns:`, schema.map((col: any) => `${col.name}: ${col.type}`));
        
        const hasCreatedAt = schema.some((col: any) => col.name === 'created_at');
        
        if (!hasCreatedAt && table !== 'attendance') { // attendance might not need it
          console.log(`➕ Adding created_at column to ${table} table...`);
          db.exec(`ALTER TABLE ${table} ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`);
          console.log(`✅ created_at column added to ${table}`);
        } else {
          console.log(`ℹ️ ${table} already has created_at or doesn't need it`);
        }
      } catch (error) {
        console.log(`⚠️ Could not check ${table} table:`, error.message);
      }
    }
    
    // Verify admin user still exists
    console.log('\n👤 Verifying admin user...');
    const admin = db.prepare("SELECT * FROM staff WHERE name = 'Admin' OR role = 'owner'").get() as any;
    if (admin) {
      console.log('✅ Admin user found:', admin.name, admin.role);
    } else {
      console.log('❌ Admin user not found');
    }
    
    db.close();
    console.log('\n🎉 Database schema fix completed');
    
  } catch (error) {
    console.error('❌ Error fixing database schema:', error);
  }
}

fixDatabaseSchema();
