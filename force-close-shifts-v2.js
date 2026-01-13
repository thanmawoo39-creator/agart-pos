/**
 * POS Hard Reset Helper - Force Close All Active Shifts
 * 
 * This script will force close all active shifts in the database
 * Usage: node force-close-shifts.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function forceCloseAllShifts() {
  console.log('🔧 POS Hard Reset Helper - Force Closing All Active Shifts');
  console.log('=' .repeat(60));

  return new Promise((resolve, reject) => {
    // Find all active shifts (clockOutTime is empty string)
    db.all(
      "SELECT * FROM attendance WHERE clockOutTime = ''",
      [],
      (err, activeShifts) => {
        if (err) {
          console.error('❌ Error finding active shifts:', err);
          reject(err);
          return;
        }

        if (activeShifts.length === 0) {
          console.log('✅ No active shifts found. All shifts are already properly closed.');
          db.close();
          resolve();
          return;
        }

        console.log(`📊 Found ${activeShifts.length} active shift(s):`);
        console.log('');

        const now = new Date().toISOString();
        let closedCount = 0;

        // Force close each active shift
        activeShifts.forEach((shift, index) => {
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
          db.run(
            "UPDATE attendance SET clockOutTime = ?, totalHours = ? WHERE id = ?",
            [now, totalHours, shift.id],
            (updateErr) => {
              if (updateErr) {
                console.error(`❌ Error closing shift for ${shift.staffName}:`, updateErr);
              } else {
                closedCount++;
              }

              // Check if this was the last shift
              if (closedCount === activeShifts.length) {
                console.log('=' .repeat(60));
                console.log(`✅ Successfully force-closed ${closedCount} shift(s)`);
                console.log('');
                console.log('🚀 You can now start fresh without "Shift already open" errors');
                console.log('');
                console.log('⚠️  Note: This is a hard reset. All financial data has been preserved.');
                console.log('     If you need to audit these changes, check the attendance table.');
                db.close();
                resolve();
              }
            }
          );
        });
      }
    );
  });
}

// Run the script
forceCloseAllShifts().catch(console.error);
