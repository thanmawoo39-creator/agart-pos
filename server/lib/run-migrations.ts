import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Run database migrations
 * Safely adds currency columns to app_settings table if they don't exist
 */
export async function runMigrations() {
  console.log("Running database migrations...");

  try {
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
        await db.run(sql`ALTER TABLE app_settings ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'MMK'`);
        console.log("✅ Added currency_code column");
      }

      // Add currency_symbol column
      if (!columnNames.includes('currency_symbol')) {
        await db.run(sql`ALTER TABLE app_settings ADD COLUMN currency_symbol TEXT NOT NULL DEFAULT 'K'`);
        console.log("✅ Added currency_symbol column");
      }

      // Add currency_position column
      if (!columnNames.includes('currency_position')) {
        await db.run(sql`ALTER TABLE app_settings ADD COLUMN currency_position TEXT NOT NULL DEFAULT 'after'`);
        console.log("✅ Added currency_position column");
      }

      console.log("✅ Currency columns migration completed successfully");
    } else {
      console.log("✅ Currency columns already exist, skipping migration");
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
    throw error;
  }
}
