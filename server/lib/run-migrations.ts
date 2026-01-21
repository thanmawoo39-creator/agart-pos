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
 * Run database migrations for PostgreSQL
 * Schema is managed via Drizzle migrations - this function handles any runtime checks
 */
export async function runMigrations() {
  console.log("Running PostgreSQL database setup checks...");

  try {
    // PostgreSQL doesn't use PRAGMA - schema introspection uses information_schema
    // Most migrations are now handled by Drizzle's migration system

    // Helper function to check if a column exists in PostgreSQL
    const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
      try {
        const result = await db.execute(sql`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = ${tableName} AND column_name = ${columnName}
        `);
        return (result as any).rows?.length > 0;
      } catch {
        return false;
      }
    };

    // Helper function to safely add a column if it doesn't exist
    const ensureColumn = async (tableName: string, columnName: string, columnDef: string) => {
      const exists = await columnExists(tableName, columnName);
      if (!exists) {
        console.log(`Adding ${columnName} column to ${tableName} table...`);
        try {
          await db.execute(sql.raw(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnDef}`));
          console.log(`✅ Added ${columnName} column to ${tableName} table`);
        } catch (error) {
          console.log(`Column ${columnName} may already exist or error:`, error);
        }
      }
    };

    // Ensure critical columns exist (PostgreSQL syntax with IF NOT EXISTS)
    await ensureColumn('products', 'business_unit_id', "TEXT DEFAULT '1'");
    await ensureColumn('products', 'translated_name', 'TEXT');
    await ensureColumn('sales', 'business_unit_id', "TEXT NOT NULL DEFAULT '1'");
    await ensureColumn('sales', 'status', "TEXT NOT NULL DEFAULT 'pending'");
    await ensureColumn('sales', 'order_type', "TEXT NOT NULL DEFAULT 'dine-in'");
    await ensureColumn('sales', 'customer_name', 'TEXT');
    await ensureColumn('sales', 'customer_phone', 'TEXT');
    await ensureColumn('sales', 'delivery_address', 'TEXT');
    await ensureColumn('sales', 'payment_proof_url', 'TEXT');
    await ensureColumn('sales', 'requested_delivery_time', 'TEXT');
    await ensureColumn('customers', 'business_unit_id', "TEXT DEFAULT '1'");
    await ensureColumn('staff', 'business_unit_id', "TEXT DEFAULT '1'");
    await ensureColumn('attendance', 'business_unit_id', "TEXT DEFAULT '1'");
    await ensureColumn('shifts', 'business_unit_id', "TEXT DEFAULT '1'");

    // Customer credit lifecycle fields
    await ensureColumn('customers', 'due_date', 'TEXT');
    await ensureColumn('customers', 'credit_due_date', 'TEXT');
    await ensureColumn('customers', 'monthly_closing_day', 'INTEGER');

    // Credit ledger transaction type
    await ensureColumn('credit_ledger', 'transaction_type', 'TEXT');

    // Normalize credit ledger types
    try {
      await db.execute(sql`UPDATE credit_ledger SET type='sale' WHERE type='charge'`);
      await db.execute(sql`UPDATE credit_ledger SET type='repayment' WHERE type='payment'`);
    } catch {
      // ignore
    }

    // Ensure app_settings has required columns
    await ensureColumn('app_settings', 'currency_code', "TEXT NOT NULL DEFAULT 'MMK'");
    await ensureColumn('app_settings', 'currency_symbol', "TEXT NOT NULL DEFAULT 'K'");
    await ensureColumn('app_settings', 'currency_position', "TEXT NOT NULL DEFAULT 'after'");
    await ensureColumn('app_settings', 'mobile_payment_qr_url', 'TEXT');
    await ensureColumn('app_settings', 'delivery_rider_pin', "TEXT DEFAULT '8888'");

    // Expenses table columns
    await ensureColumn('expenses', 'description', "TEXT DEFAULT ''");
    await ensureColumn('expenses', 'note', 'TEXT');
    await ensureColumn('expenses', 'receipt_image_url', 'TEXT');

    console.log("✅ PostgreSQL database setup checks completed");
  } catch (error) {
    console.error("❌ PostgreSQL migration check failed:", error);
  }
}
