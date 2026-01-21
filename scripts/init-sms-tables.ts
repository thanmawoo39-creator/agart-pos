/**
 * SMS Database Initialization Script
 * Creates required tables for SMS logging and payment verification
 * 
 * Run with: npx tsx scripts/init-sms-tables.ts
 */

import Database from 'better-sqlite3';

const sqlite = new Database('database.sqlite');

console.log('[INIT-DB] ========================================');
console.log('[INIT-DB] Initializing SMS Tables...');
console.log('[INIT-DB] ========================================');

// 1. SMS Audit Logs (For Cashier/Admin to see all SMS history)
console.log('[INIT-DB] Re-creating sms_logs table...');
sqlite.exec(`DROP TABLE IF EXISTS sms_logs`); // Force recreation to ensure schema match
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS sms_logs (
    id TEXT PRIMARY KEY,
    sender TEXT,
    message_content TEXT,
    extracted_amount REAL,
    status TEXT DEFAULT 'received',
    matched_order_id TEXT,
    buffer_record_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
console.log('[INIT-DB] ✓ sms_logs table ready');

// 2. Payment Buffers (For verifying orders) - Already exists in schema but ensure it exists
console.log('[INIT-DB] Ensuring payment_buffers table exists...');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS payment_buffers (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    transaction_id TEXT,
    sender_name TEXT,
    sms_content TEXT,
    verified INTEGER DEFAULT 0,
    verified_at TEXT,
    order_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
console.log('[INIT-DB] ✓ payment_buffers table ready');

console.log('[INIT-DB] ========================================');
console.log('[INIT-DB] ✅ All SMS tables created successfully!');
console.log('[INIT-DB] ========================================');

sqlite.close();
