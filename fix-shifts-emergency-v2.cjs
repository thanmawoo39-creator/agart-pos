const { drizzle } = require('drizzle-orm');
const { sqliteTableCreator } = require('drizzle-orm/sqlite-core');
const Database = require('better-sqlite3');
const schema = require('./server/db/schema');

// Create database connection
const db = new Database('./database.sqlite', { verbose: console.log });
const drizzleDb = drizzle(db, { schema });

async function fixShifts() {
  try {
    console.log('🔧 Force-closing all unclosed shifts...');
    
    // Force close all shifts that are still open
    const result = await drizzleDb.update(schema.shifts)
      .set({ 
        isOpen: 0,
        closedAt: new Date().toISOString()
      })
      .where(schema.shifts.isOpen.eq(1));
    
    console.log(`✅ Updated ${result.changes} shifts`);
    
    // Verify the fix
    const openShifts = await drizzleDb.select()
      .from(schema.shifts)
      .where(schema.shifts.isOpen.eq(1));
    
    console.log(`📊 Open shifts remaining: ${openShifts.length}`);
    
    if (openShifts.length === 0) {
      console.log('✅ All shifts have been force-closed successfully!');
    } else {
      console.log('⚠️ Some shifts are still open, manual check required');
    }
    
  } catch (error) {
    console.error('❌ Error fixing shifts:', error);
  } finally {
    db.close();
  }
}

fixShifts();
