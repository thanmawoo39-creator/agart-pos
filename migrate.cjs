console.log('Running migration...');
const sqlite = require('sqlite3');
const db = sqlite('database.sqlite');

db.run('ALTER TABLE products ADD COLUMN businessUnitId TEXT DEFAULT "Grocery"', (err) => {
  if (err) {
    console.error('Error adding businessUnitId to products:', err);
  } else {
    console.log('Added businessUnitId to products table');
  }
});

db.run('ALTER TABLE sales ADD COLUMN businessUnitId TEXT DEFAULT "Grocery"', (err) => {
  if (err) {
    console.error('Error adding businessUnitId to sales:', err);
  } else {
    console.log('Added businessUnitId to sales table');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
  number TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  business_unit_id TEXT DEFAULT 'Restaurant',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`, (err) => {
  if (err) {
    console.error('Error creating tables table:', err);
  } else {
    console.log('Created tables table');
  }
});

// Insert sample tables for Restaurant mode
const sampleTables = [
  ['1', '1', 4, 'available', 'Restaurant'],
  ['2', '2', 4, 'occupied', 'Restaurant'],
  ['3', '3', 6, 'available', 'Restaurant'],
  ['4', '4', 2, 'reserved', 'Restaurant'],
  ['5', '5', 8, 'available', 'Restaurant'],
  ['6', '6', 4, 'occupied', 'Restaurant']
];

const insertTable = db.prepare('INSERT OR IGNORE INTO tables (id, number, capacity, status, business_unit_id) VALUES (?, ?, ?, ?, ?)');

sampleTables.forEach(([id, number, capacity, status, businessUnitId]) => {
  insertTable.run([id, number, capacity, status, businessUnitId], (err) => {
    if (err) {
      console.error('Error inserting sample table:', err);
    }
  });
});

console.log('Migration completed');
db.close();
