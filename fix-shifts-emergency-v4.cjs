const Database = require('better-sqlite3');

// Create database connection
const sqlite = new Database('database.sqlite', { verbose: console.log });

async function fixShifts() {
  try {
    console.log('🔧 Force-closing all unclosed shifts...');
    
    // Force close all shifts that are still open
    const stmt = sqlite.prepare(`
      UPDATE shifts 
      SET isOpen = 0, closedAt = ?
      WHERE isOpen = 1
    `);
    
    const result = stmt.run(new Date().toISOString());
    console.log(`✅ Updated ${result.changes} shifts`);
    
    // Verify the fix
    const verifyStmt = sqlite.prepare('SELECT COUNT(*) as count FROM shifts WHERE isOpen = 1');
    const verifyResult = verifyStmt.get();
    
    console.log(`📊 Open shifts remaining: ${verifyResult.count}`);
    
    if (verifyResult.count === 0) {
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
