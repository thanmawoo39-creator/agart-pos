const { drizzle } = require('drizzle-orm');
const { mysqlTableCreator } = require('drizzle-orm/mysql-core');
const mysql = require('mysql2/promise');
const schema = require('./server/db/schema');

// Create database connection
const poolConnection = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos',
  waitForConnections: true,
  connectionLimit: 10,
});

const db = drizzle(poolConnection, { schema, mode: 'default' });

async function fixShifts() {
  try {
    console.log('🔧 Force-closing all unclosed shifts...');
    
    // Force close all shifts that are still open
    const result = await db.update(schema.shifts)
      .set({ 
        isOpen: 0,
        closedAt: new Date()
      })
      .where(schema.shifts.isOpen.eq(1));
    
    console.log(`✅ Updated ${result[0].changedRows} shifts`);
    
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
    await poolConnection.end();
  }
}

fixShifts();
