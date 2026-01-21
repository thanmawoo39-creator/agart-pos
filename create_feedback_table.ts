import Database from 'better-sqlite3';

const db = new Database('sqlite.db');

// Create feedback table
db.prepare(`
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (order_id) REFERENCES sales(id)
  )
`).run();

console.log('Feedback table created successfully.');
