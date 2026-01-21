-- Quick fix: Mark all unpaid sales for Table 2 as paid
-- Run this SQL directly in your database to immediately fix Table 2

UPDATE sales 
SET paymentStatus = 'paid', 
    timestamp = datetime('now')
WHERE tableNumber = '2' 
  AND paymentStatus = 'unpaid';

-- To see all unpaid table sales:
-- SELECT id, tableNumber, paymentStatus, total, createdAt FROM sales WHERE tableNumber IS NOT NULL AND paymentStatus = 'unpaid' ORDER BY tableNumber;

-- To clear all old unpaid table orders (use carefully):
-- UPDATE sales SET paymentStatus = 'paid', timestamp = datetime('now') WHERE tableNumber IS NOT NULL AND paymentStatus = 'unpaid' AND datetime(createdAt) < datetime('now', '-24 hours');
