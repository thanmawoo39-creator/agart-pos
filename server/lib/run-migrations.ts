import { db } from "./db";
import { sql } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";

function stripSqlCommentsAndWhitespace(source: string): string {
  return (source || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*--.*$/gm, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
}

export async function ensureNonEmptySqlMigrations(migrationsFolder: string) {
  try {
    const files = await fs.readdir(migrationsFolder);
    const sqlFiles = files.filter((f) => f.toLowerCase().endsWith('.sql'));

    for (const file of sqlFiles) {
      const fullPath = path.join(migrationsFolder, file);
      const content = await fs.readFile(fullPath, 'utf8').catch(() => '');
      if (stripSqlCommentsAndWhitespace(content).length === 0) {
        await fs.writeFile(fullPath, 'SELECT 1;\n', 'utf8');
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Run database migrations
 * Safely adds currency columns to app_settings table if they don't exist
 */
export async function runMigrations() {
  console.log("Running database migrations...");

  try {
    const runSql = async (statement: string) => {
      if (!statement || statement.trim().length === 0) {
        return;
      }
      await db.run(sql.raw(statement));
    };

    // Check if currency columns exist
    const tableInfo = await db.all(sql`PRAGMA table_info(app_settings)`);
    const columnNames = tableInfo.map((col: any) => col.name);

    const currencyColumnsExist =
      columnNames.includes('currency_code') &&
      columnNames.includes('currency_symbol') &&
      columnNames.includes('currency_position');

    if (!currencyColumnsExist) {
      console.log("Adding currency columns to app_settings table...");

      // Add currency_code column
      if (!columnNames.includes('currency_code')) {
        await runSql("ALTER TABLE app_settings ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'MMK'");
        console.log("✅ Added currency_code column");
      }

      // Add currency_symbol column
      if (!columnNames.includes('currency_symbol')) {
        await runSql("ALTER TABLE app_settings ADD COLUMN currency_symbol TEXT NOT NULL DEFAULT 'K'");
        console.log("✅ Added currency_symbol column");
      }

      // Add currency_position column
      if (!columnNames.includes('currency_position')) {
        await runSql("ALTER TABLE app_settings ADD COLUMN currency_position TEXT NOT NULL DEFAULT 'after'");
        console.log("✅ Added currency_position column");
      }

      console.log("✅ Currency columns migration completed successfully");
    } else {
      console.log("✅ Currency columns already exist, skipping migration");
    }

    // Check if app_settings has mobile payment QR column
    const mobileQrColumnExists = columnNames.includes('mobile_payment_qr_url');
    if (!mobileQrColumnExists) {
      console.log("Adding mobile_payment_qr_url column to app_settings table...");
      await runSql("ALTER TABLE app_settings ADD COLUMN mobile_payment_qr_url TEXT");
      console.log("✅ Added mobile_payment_qr_url column");
    } else {
      console.log("✅ mobile_payment_qr_url column already exists in app_settings");
    }

    // Check if app_settings has delivery_rider_pin
    const deliveryPinColumnExists = columnNames.includes('delivery_rider_pin');
    if (!deliveryPinColumnExists) {
      console.log("Adding delivery_rider_pin column to app_settings table...");
      await runSql("ALTER TABLE app_settings ADD COLUMN delivery_rider_pin TEXT DEFAULT '8888'");
      console.log("✅ Added delivery_rider_pin column");
    } else {
      console.log("✅ delivery_rider_pin column already exists in app_settings");
    }

    // Ensure business_unit_id columns exist on core tables (older DBs may be missing them)
    const ensureColumn = async (table: string, column: string, alterSql: any) => {
      const info = await db.all(sql.raw(`PRAGMA table_info(${table})`));
      const names = (info as any[]).map((c: any) => c.name);
      if (!names.includes(column)) {
        console.log(`Adding ${column} column to ${table} table...`);
        await db.run(alterSql);
        console.log(`✅ Added ${column} column to ${table} table`);
      }
    };

    await ensureColumn('products', 'business_unit_id', sql`ALTER TABLE products ADD COLUMN business_unit_id TEXT NOT NULL DEFAULT '1'`);
    await ensureColumn('products', 'translated_name', sql`ALTER TABLE products ADD COLUMN translated_name TEXT`);
    await ensureColumn('sales', 'business_unit_id', sql`ALTER TABLE sales ADD COLUMN business_unit_id TEXT NOT NULL DEFAULT '1'`);
    await ensureColumn('sales', 'status', sql`ALTER TABLE sales ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
    await ensureColumn('sales', 'order_type', sql`ALTER TABLE sales ADD COLUMN order_type TEXT NOT NULL DEFAULT 'dine-in'`);
    await ensureColumn('sales', 'customer_name', sql`ALTER TABLE sales ADD COLUMN customer_name TEXT`);
    await ensureColumn('sales', 'customer_phone', sql`ALTER TABLE sales ADD COLUMN customer_phone TEXT`);
    await ensureColumn('sales', 'delivery_address', sql`ALTER TABLE sales ADD COLUMN delivery_address TEXT`);
    await ensureColumn('sales', 'payment_proof_url', sql`ALTER TABLE sales ADD COLUMN payment_proof_url TEXT`);
    await ensureColumn('sales', 'requested_delivery_time', sql`ALTER TABLE sales ADD COLUMN requested_delivery_time TEXT`);
    await ensureColumn('customers', 'business_unit_id', sql`ALTER TABLE customers ADD COLUMN business_unit_id TEXT NOT NULL DEFAULT '1'`);
    await ensureColumn('staff', 'business_unit_id', sql`ALTER TABLE staff ADD COLUMN business_unit_id TEXT NOT NULL DEFAULT '1'`);
    await ensureColumn('attendance', 'business_unit_id', sql`ALTER TABLE attendance ADD COLUMN business_unit_id TEXT NOT NULL DEFAULT '1'`);
    await ensureColumn('shifts', 'business_unit_id', sql`ALTER TABLE shifts ADD COLUMN business_unit_id TEXT NOT NULL DEFAULT '1'`);
    // tables table may not exist in older DBs; if it exists but lacks business_unit_id, add it
    try {
      await ensureColumn('tables', 'business_unit_id', sql`ALTER TABLE tables ADD COLUMN business_unit_id TEXT NOT NULL DEFAULT '1'`);
      await ensureColumn('tables', 'current_order', sql`ALTER TABLE tables ADD COLUMN current_order TEXT`);
      await ensureColumn('tables', 'last_ordered', sql`ALTER TABLE tables ADD COLUMN last_ordered TEXT`);
      await ensureColumn('tables', 'service_status', sql`ALTER TABLE tables ADD COLUMN service_status TEXT`);
    } catch {
      // ignore if tables table doesn't exist yet
    }

    // Phase 12: customer credit lifecycle fields
    await ensureColumn('customers', 'due_date', sql`ALTER TABLE customers ADD COLUMN due_date TEXT`);
    await ensureColumn('customers', 'credit_due_date', sql`ALTER TABLE customers ADD COLUMN credit_due_date TEXT`);
    await ensureColumn('customers', 'monthly_closing_day', sql`ALTER TABLE customers ADD COLUMN monthly_closing_day INTEGER`);

    // Phase 15: credit ledger transaction type (optional explicit field)
    await ensureColumn('credit_ledger', 'transaction_type', sql`ALTER TABLE credit_ledger ADD COLUMN transaction_type TEXT`);

    // Phase 12: normalize credit ledger types
    try {
      await runSql("UPDATE credit_ledger SET type='sale' WHERE type='charge'");
      await runSql("UPDATE credit_ledger SET type='repayment' WHERE type='payment'");
    } catch {
      // ignore
    }

    // Phase 12: kitchen tickets (KOT)
    try {
      await runSql(`CREATE TABLE IF NOT EXISTS kitchen_tickets (
        id TEXT PRIMARY KEY,
        business_unit_id TEXT NOT NULL,
        table_id TEXT,
        table_number TEXT,
        items TEXT,
        status TEXT NOT NULL DEFAULT 'in_preparation',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`);
    } catch {
      // ignore
    }

    // Check if expenses table has description column
    const expensesTableInfo = await db.all(sql`PRAGMA table_info(expenses)`);
    const expensesColumnNames = expensesTableInfo.map((col: any) => col.name);

    const descriptionColumnExists = expensesColumnNames.includes('description');

    if (!descriptionColumnExists) {
      console.log("Adding description column to expenses table...");
      await db.run(sql`ALTER TABLE expenses ADD COLUMN description TEXT DEFAULT ''`);
      console.log("✅ Added description column to expenses table");
    } else {
      console.log("✅ Description column already exists in expenses table");
    }

    // Check if expenses table has note column
    const noteColumnExists = expensesColumnNames.includes('note');

    if (!noteColumnExists) {
      console.log("Adding note column to expenses table...");
      await db.run(sql`ALTER TABLE expenses ADD COLUMN note TEXT`);
      console.log("✅ Added note column to expenses table");
    } else {
      console.log("✅ Note column already exists in expenses table");
    }

    // Check if expenses table has receipt_image_url column
    const receiptImageColumnExists = expensesColumnNames.includes('receipt_image_url');

    if (!receiptImageColumnExists) {
      console.log("Adding receipt_image_url column to expenses table...");
      await db.run(sql`ALTER TABLE expenses ADD COLUMN receipt_image_url TEXT`);
      console.log("✅ Added receipt_image_url column to expenses table");
    } else {
      console.log("✅ Receipt_image_url column already exists in expenses table");
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
}
