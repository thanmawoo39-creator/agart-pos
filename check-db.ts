import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

console.log('=== STAFF TABLE ===');
try {
  const staff = db.prepare('SELECT * FROM staff').all();
  console.log('Staff records:', staff.length);
  console.log(staff);
} catch (error) {
  console.log('Error querying staff:', error.message);
}

console.log('\n=== ATTENDANCE TABLE ===');
try {
  const attendance = db.prepare('SELECT * FROM attendance LIMIT 3').all();
  console.log('Attendance records:', attendance.length);
  console.log(attendance);
} catch (error) {
  console.log('Error querying attendance:', error.message);
}

console.log('\n=== SHIFTS TABLE ===');
try {
  const shifts = db.prepare('SELECT * FROM shifts LIMIT 3').all();
  console.log('Shift records:', shifts.length);
  console.log(shifts);
} catch (error) {
  console.log('Error querying shifts:', error.message);
}

db.close();
