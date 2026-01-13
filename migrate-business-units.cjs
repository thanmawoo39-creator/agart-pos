console.log('Running business units migration...');

const { Database } = require('sqlite3');
const db = new Database('database.sqlite');

// Create business_units table
db.run(`CREATE TABLE IF NOT EXISTS business_units (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))) NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  settings TEXT,
  is_active TEXT DEFAULT 'true' NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)`, (err) => {
  if (err) {
    console.error('Error creating business_units table:', err);
  } else {
    console.log('Created business_units table');
  }
});

// Insert default business units (Grocery and Restaurant)
const insertBusinessUnit = db.prepare('INSERT OR IGNORE INTO business_units (id, name, type, settings, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

const defaultUnits = [
  ['grocery-001', 'Grocery', 'Grocery', '{}', 'true', new Date().toISOString(), new Date().toISOString()],
  ['restaurant-001', 'Restaurant', 'Restaurant', '{}', 'true', new Date().toISOString(), new Date().toISOString()]
];

defaultUnits.forEach(([id, name, type, settings, isActive, createdAt, updatedAt]) => {
  insertBusinessUnit.run([id, name, type, settings, isActive, createdAt, updatedAt], (err) => {
    if (err) {
      console.error('Error inserting default business unit:', err);
    } else {
      console.log(`Inserted default business unit: ${name}`);
    }
  });
});

// Get the first grocery unit to use as default for existing products
db.get('SELECT id FROM business_units WHERE type = "Grocery" LIMIT 1', (err, row) => {
  if (err) {
    console.error('Error getting grocery business unit:', err);
  } else if (row) {
    const groceryId = row.id;
    
    // Update existing products to have businessUnitId
    db.run('UPDATE products SET business_unit_id = ? WHERE business_unit_id IS NULL', [groceryId], (err) => {
      if (err) {
        console.error('Error updating products business unit:', err);
      } else {
        console.log('Updated existing products with grocery business unit');
      }
    });
    
    // Update existing sales to have businessUnitId  
    db.run('UPDATE sales SET business_unit_id = ? WHERE business_unit_id IS NULL', [groceryId], (err) => {
      if (err) {
        console.error('Error updating sales business unit:', err);
      } else {
        console.log('Updated existing sales with grocery business unit');
      }
    });
    
    // Update existing tables to have businessUnitId
    db.run('UPDATE tables SET business_unit_id = ? WHERE business_unit_id IS NULL', [groceryId], (err) => {
      if (err) {
        console.error('Error updating tables business unit:', err);
      } else {
        console.log('Updated existing tables with grocery business unit');
      }
    });
  }
});

console.log('Business units migration completed');
db.close();
