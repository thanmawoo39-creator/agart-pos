/**
 * POS Hard Reset Helper - Force Close All Active Shifts
 * 
 * This script will force close all active shifts in database
 * Usage: node force-close-shifts.cjs
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function forceCloseAllShifts() {
  console.log('🔧 POS Hard Reset Helper - Force Closing All Active Shifts');
  console.log('=' .repeat(60));

  const getTableColumns = (tableName) => new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map((r) => r.name));
    });
  });

  const runSql = (sql, params) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes || 0 });
    });
  });

  const allSql = (sql, params) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        const nowIso = new Date().toISOString();
        const nowSql = "datetime('now')";

        let attendanceClosed = 0;
        let shiftsClosed = 0;

        // 1) Close open attendance records (this is the source-of-truth for the "shift already open" check)
        const attendanceColumns = await getTableColumns('attendance').catch(() => []);
        if (attendanceColumns.length > 0) {
          const openAttendance = await allSql(
            "SELECT * FROM attendance WHERE clock_out_time IS NULL OR clock_out_time = ''",
            []
          );

          if (openAttendance.length > 0) {
            console.log(`📊 Found ${openAttendance.length} open attendance record(s):`);
            console.log('');

            let processed = 0;
            await Promise.all(
              openAttendance.map(async (row) => {
                try {
                  const clockIn = row.clock_in_time || row.clockInTime;
                  const clockInTime = clockIn ? new Date(clockIn) : null;
                  const clockOutTime = new Date(nowIso);
                  const totalHours = clockInTime
                    ? (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)
                    : null;

                  console.log(`🔄 Closing attendance for ${row.staff_name || row.staffName}:`);
                  console.log(`   📅 Clock In: ${clockIn || 'Unknown'}`);
                  console.log(`   📅 Clock Out: ${nowIso}`);
                  if (typeof totalHours === 'number') {
                    console.log(`   ⏱️  Total Hours: ${totalHours.toFixed(2)}`);
                  }
                  console.log('');

                  const params = typeof totalHours === 'number'
                    ? [nowIso, totalHours, row.id]
                    : [nowIso, row.id];
                  const sql = typeof totalHours === 'number'
                    ? "UPDATE attendance SET clock_out_time = ?, total_hours = ? WHERE id = ?"
                    : "UPDATE attendance SET clock_out_time = ? WHERE id = ?";

                  const result = await runSql(sql, params);
                  attendanceClosed += result.changes;
                } catch (e) {
                  console.error('❌ Error closing attendance record:', e);
                } finally {
                  processed++;
                }
              })
            );

            if (processed !== openAttendance.length) {
              console.warn('⚠️  Not all attendance rows were processed as expected.');
            }
          } else {
            console.log('✅ No open attendance records found.');
          }
        }

        // 2) Close open shifts records (for legacy/compatibility)
        const shiftColumns = await getTableColumns('shifts').catch(() => []);
        if (shiftColumns.length > 0) {
          if (shiftColumns.includes('isOpen') && shiftColumns.includes('closedAt')) {
            const result = await runSql(
              `UPDATE shifts SET isOpen = 0, closedAt = CURRENT_TIMESTAMP WHERE isOpen = 1`,
              []
            );
            shiftsClosed += result.changes;
          } else if (shiftColumns.includes('status')) {
            const endTimeColumn = shiftColumns.includes('end_time') ? 'end_time' : (shiftColumns.includes('endTime') ? 'endTime' : null);
            const setEndTimeSql = endTimeColumn ? `, ${endTimeColumn} = ${nowSql}` : '';
            const result = await runSql(
              `UPDATE shifts SET status = 'closed'${setEndTimeSql} WHERE status = 'open'`,
              []
            );
            shiftsClosed += result.changes;
          }
        }

        console.log('=' .repeat(60));
        console.log(`✅ Attendance rows closed: ${attendanceClosed}`);
        console.log(`✅ Shifts rows closed: ${shiftsClosed}`);
        console.log('');
        console.log('🚀 You can now start fresh without "Shift already open" errors');

        db.close();
        resolve();
      } catch (err) {
        console.error('❌ Force close script failed:', err);
        try { db.close(); } catch (_) {}
        reject(err);
      }
    });
  });
}

// Run the script
forceCloseAllShifts().catch(console.error);
