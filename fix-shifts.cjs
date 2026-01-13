const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

try {
  console.log('🔄 Force closing all open shifts...');
  
  // Check table structure first
  const tableInfo = db.prepare("PRAGMA table_info(attendance)").all();
  console.log('📋 Attendance table columns:', tableInfo.map(col => col.name));
  
  // Update attendance records - set clock_out_time for those without it
  const result = db.prepare(`
    UPDATE attendance 
    SET clock_out_time = CURRENT_TIMESTAMP 
    WHERE clock_out_time IS NULL
  `).run();
  
  console.log(`✅ Updated ${result.changes} attendance records`);
  
  // Verify the changes
  const openShifts = db.prepare('SELECT COUNT(*) as count FROM attendance WHERE clock_out_time IS NULL').get();
  console.log(`📊 Unclosed shifts remaining: ${openShifts.count}`);
  
  console.log('✅ All shifts force-closed successfully');
} catch (error) {
  console.error('❌ Error closing shifts:', error);
} finally {
  db.close();
}
