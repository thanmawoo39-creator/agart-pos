const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const schema = require('./shared/schema');

// Create database connection
const sqlite = new Database('database.sqlite');
const db = drizzle(sqlite, { schema });

async function fixShifts() {
  try {
    console.log('🔧 Force-closing all unclosed shifts...');
    
    // Force close all shifts that are still open
    const result = await db.update(schema.shifts)
      .set({ 
        isOpen: 0,
        closedAt: new Date().toISOString()
      })
      .where(schema.shifts.isOpen.eq(1));
    
    console.log(`✅ Updated ${result.changes} shifts`);
    
    // Verify the fix
    const openShifts = await db.select()
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
    sqlite.close();
  }
}

fixShifts();
