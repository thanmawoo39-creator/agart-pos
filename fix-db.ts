/**
 * Database Fix Script
 * Manually adds missing columns to the sales table
 * Run with: npx tsx fix-db.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

console.log('🔧 Starting database fix...');
console.log('📂 Database path:', dbPath);

try {
    // Get current table info
    const tableInfo: any[] = db.prepare("PRAGMA table_info(sales)").all();
    const existingColumns = tableInfo.map((col: any) => col.name);

    console.log('\n📋 Existing columns in sales table:');
    console.log(existingColumns.join(', '));

    // Add order_source column if missing
    if (!existingColumns.includes('order_source')) {
        console.log('\n➕ Adding order_source column...');
        db.prepare(`
      ALTER TABLE sales 
      ADD COLUMN order_source TEXT NOT NULL DEFAULT 'pos'
    `).run();
        console.log('✅ order_source column added successfully');
    } else {
        console.log('\n✓ order_source column already exists');
    }

    // Add payment_status column if missing
    if (!existingColumns.includes('payment_status')) {
        console.log('\n➕ Adding payment_status column...');
        db.prepare(`
      ALTER TABLE sales 
      ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'paid'
    `).run();
        console.log('✅ payment_status column added successfully');
    } else {
        console.log('\n✓ payment_status column already exists');
    }

    // Add payment_slip_url column if missing (if not already present)
    if (!existingColumns.includes('payment_slip_url')) {
        console.log('\n➕ Adding payment_slip_url column...');
        db.prepare(`
      ALTER TABLE sales 
      ADD COLUMN payment_slip_url TEXT
    `).run();
        console.log('✅ payment_slip_url column added successfully');
    } else {
        console.log('\n✓ payment_slip_url column already exists');
    }

    // Verify changes
    const updatedTableInfo: any[] = db.prepare("PRAGMA table_info(sales)").all();
    const updatedColumns = updatedTableInfo.map((col: any) => col.name);

    console.log('\n📋 Updated columns in sales table:');
    console.log(updatedColumns.join(', '));

    // Check for the new columns
    const hasOrderSource = updatedColumns.includes('order_source');
    const hasPaymentStatus = updatedColumns.includes('payment_status');
    const hasPaymentSlipUrl = updatedColumns.includes('payment_slip_url');

    if (hasOrderSource && hasPaymentStatus && hasPaymentSlipUrl) {
        console.log('\n✅ Database fix completed successfully!');
        console.log('✅ All required columns are now present');
    } else {
        console.log('\n⚠️ Warning: Some columns may be missing');
        if (!hasOrderSource) console.log('   - Missing: order_source');
        if (!hasPaymentStatus) console.log('   - Missing: payment_status');
        if (!hasPaymentSlipUrl) console.log('   - Missing: payment_slip_url');
    }

} catch (error) {
    console.error('\n❌ Error fixing database:', error);
    process.exit(1);
} finally {
    db.close();
    console.log('\n🔒 Database connection closed');
}
