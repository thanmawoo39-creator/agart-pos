const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

try {
  console.log('🔄 Force closing all open shifts...');
  
  const result = db.prepare(`
    UPDATE attendance 
    SET isOpen = 0, 
        closedAt = CURRENT_TIMESTAMP 
    WHERE isOpen = 1 OR closedAt IS NULL
  `).run();
  
  console.log(`✅ Updated ${result.changes} shift records`);
  
  // Verify the changes
  const openShifts = db.prepare('SELECT COUNT(*) as count FROM attendance WHERE isOpen = 1').get();
  console.log(`📊 Open shifts remaining: ${openShifts.count}`);
  
  console.log('✅ All shifts force-closed successfully');
} catch (error) {
  console.error('❌ Error closing shifts:', error);
} finally {
  db.close();
}
