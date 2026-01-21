/**
 * Migration script for Lunch Box Mode (Public Online Ordering)
 * Adds new columns for daily specials and delivery orders
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.join(process.cwd(), 'database.sqlite');
console.log('Opening database:', dbPath);

const db = new Database(dbPath);

try {
  console.log('\n--- Checking products table ---');
  const tableInfo = db.pragma('table_info(products)');
  const hasIsDailySpecial = tableInfo.some(col => col.name === 'is_daily_special');
  const hasIsStandardMenu = tableInfo.some(col => col.name === 'is_standard_menu');
  console.log('Has is_daily_special:', hasIsDailySpecial);
  console.log('Has is_standard_menu:', hasIsStandardMenu);

  if (!hasIsDailySpecial) {
    db.exec('ALTER TABLE products ADD COLUMN is_daily_special INTEGER NOT NULL DEFAULT 0');
    console.log('✓ Added is_daily_special column to products');
  } else {
    console.log('✓ is_daily_special column already exists');
  }

  if (!hasIsStandardMenu) {
    db.exec('ALTER TABLE products ADD COLUMN is_standard_menu INTEGER NOT NULL DEFAULT 0');
    console.log('✓ Added is_standard_menu column to products');
  } else {
    console.log('✓ is_standard_menu column already exists');
  }

  console.log('\n--- Checking sales table ---');
  const salesInfo = db.pragma('table_info(sales)');

  const hasOrderType = salesInfo.some(col => col.name === 'order_type');
  const hasCustomerName = salesInfo.some(col => col.name === 'customer_name');
  const hasCustomerPhone = salesInfo.some(col => col.name === 'customer_phone');
  const hasDeliveryAddress = salesInfo.some(col => col.name === 'delivery_address');
  const hasPaymentProofUrl = salesInfo.some(col => col.name === 'payment_proof_url');

  if (!hasOrderType) {
    db.exec("ALTER TABLE sales ADD COLUMN order_type TEXT NOT NULL DEFAULT 'dine-in'");
    console.log("✓ Added order_type column to sales");
  } else {
    console.log('✓ order_type column already exists');
  }

  if (!hasCustomerName) {
    db.exec('ALTER TABLE sales ADD COLUMN customer_name TEXT');
    console.log('✓ Added customer_name column to sales');
  } else {
    console.log('✓ customer_name column already exists');
  }

  if (!hasCustomerPhone) {
    db.exec('ALTER TABLE sales ADD COLUMN customer_phone TEXT');
    console.log('✓ Added customer_phone column to sales');
  } else {
    console.log('✓ customer_phone column already exists');
  }

  if (!hasDeliveryAddress) {
    db.exec('ALTER TABLE sales ADD COLUMN delivery_address TEXT');
    console.log('✓ Added delivery_address column to sales');
  } else {
    console.log('✓ delivery_address column already exists');
  }

  if (!hasPaymentProofUrl) {
    db.exec('ALTER TABLE sales ADD COLUMN payment_proof_url TEXT');
    console.log('✓ Added payment_proof_url column to sales');
  } else {
    console.log('✓ payment_proof_url column already exists');
  }

  console.log('\n✅ Migration complete!');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
