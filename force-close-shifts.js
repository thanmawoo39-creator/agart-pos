#!/usr/bin/env node

/**
 * POS Hard Reset Helper - Force Close All Active Shifts
 * 
 * This script will:
 * 1. Find all attendance records with empty clockOutTime (active shifts)
 * 2. Force close them by setting clockOutTime to current time
 * 3. Calculate totalHours for each closed shift
 * 4. Provide a summary of what was closed
 * 
 * Usage: node force-close-shifts.js
 */

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { attendance } from '../shared/schema.js';

const dbPath = './database.sqlite';
const db = new Database(dbPath);
const drizzleDb = drizzle(db);

async function forceCloseAllShifts() {
  console.log('🔧 POS Hard Reset Helper - Force Closing All Active Shifts');
  console.log('=' .repeat(60));

  try {
    // Find all active shifts (clockOutTime is empty string)
    const activeShifts = await drizzleDb.select()
      .from(attendance)
      .where(sql`clockOutTime = ''`);

    if (activeShifts.length === 0) {
      console.log('✅ No active shifts found. All shifts are already properly closed.');
      return;
    }

    console.log(`📊 Found ${activeShifts.length} active shift(s):`);
    console.log('');

    const now = new Date().toISOString();

    // Force close each active shift
    for (const shift of activeShifts) {
      const clockInTime = new Date(shift.clockInTime);
      const clockOutTime = new Date(now);
      const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      console.log(`🔄 Closing shift for ${shift.staffName}:`);
      console.log(`   📅 Clock In: ${shift.clockInTime}`);
      console.log(`   📅 Clock Out: ${now}`);
      console.log(`   ⏱️  Total Hours: ${totalHours.toFixed(2)}`);
      console.log(`   🏪 Business Unit: ${shift.businessUnitId || 'Not set'}`);
      console.log(`   💰 Opening Cash: $${shift.openingCash || 0}`);
      console.log('');

      // Update the shift record
      await drizzleDb.update(attendance)
        .set({
          clockOutTime: now,
          totalHours: totalHours
        })
        .where(eq(attendance.id, shift.id));
    }

    console.log('=' .repeat(60));
    console.log(`✅ Successfully force-closed ${activeShifts.length} shift(s)`);
    console.log('');
    console.log('🚀 You can now start fresh without "Shift already open" errors');
    console.log('');
    console.log('⚠️  Note: This is a hard reset. All financial data has been preserved.');
    console.log('     If you need to audit these changes, check the attendance table.');

  } catch (error) {
    console.error('❌ Error force-closing shifts:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Import required functions
import { eq, sql } from 'drizzle-orm';

// Run the script
forceCloseAllShifts();
