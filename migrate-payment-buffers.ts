/**
 * Payment Buffer Migration
 * Creates payment_buffers table for SMS payment verification
 * Run with: npx tsx migrate-payment-buffers.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

console.log('🔧 Creating payment_buffers table...');
console.log('📂 Database path:', dbPath);

try {
    // Create payment_buffers table
    db.prepare(`
    CREATE TABLE IF NOT EXISTS payment_buffers (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      transaction_id TEXT,
      sender_name TEXT,
      sms_content TEXT,
      verified INTEGER DEFAULT 0 NOT NULL,
      verified_at TEXT,
      order_id TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

    console.log('✅ payment_buffers table created successfully');

    // Verify table exists
    const tables: any[] = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='payment_buffers'
  `).all();

    if (tables.length > 0) {
        console.log('✅ Verified: payment_buffers table exists');

        // Show table structure
        const tableInfo: any[] = db.prepare("PRAGMA table_info(payment_buffers)").all();
        console.log('\n📋 Table structure:');
        tableInfo.forEach((col: any) => {
            console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
        });
    }

} catch (error) {
    console.error('\n❌ Error creating table:', error);
    process.exit(1);
} finally {
    db.close();
    console.log('\n🔒 Database connection closed');
}
