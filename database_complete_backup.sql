-- Database Schema Backup
-- Generated: 2026-01-11T02:50:30.941Z
-- Total Tables: 13


-- Table: alerts
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`staff_id` text NOT NULL,
	`staff_name` text NOT NULL,
	`shift_id` text,
	`amount` real,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);


-- Table: app_settings
CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`store_name` text DEFAULT 'My Store' NOT NULL,
	`store_address` text,
	`store_phone` text,
	`store_logo_url` text,
	`ai_image_recognition_enabled` integer DEFAULT false NOT NULL,
	`enable_tax` integer DEFAULT false NOT NULL,
	`tax_percentage` real DEFAULT 0 NOT NULL,
	`gemini_api_key` text,
	`groq_api_key` text,
	`enable_mobile_scanner` integer DEFAULT true NOT NULL,
	`enable_photo_capture` integer DEFAULT true NOT NULL,
	`currency_code` text DEFAULT 'MMK' NOT NULL,
	`currency_symbol` text DEFAULT 'K' NOT NULL,
	`currency_position` text DEFAULT 'after' NOT NULL,
	`updated_at` text
, `enable_local_ai` integer DEFAULT false NOT NULL, `local_ai_url` text, `local_ai_model` text);


-- Table: attendance
CREATE TABLE `attendance` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`staff_name` text NOT NULL,
	`date` text NOT NULL,
	`clock_in_time` text NOT NULL,
	`clock_out_time` text,
	`total_hours` real,
	`opening_cash` real DEFAULT 0 NOT NULL,
	`total_sales` real DEFAULT 0 NOT NULL,
	`cash_sales` real DEFAULT 0 NOT NULL,
	`card_sales` real DEFAULT 0 NOT NULL,
	`credit_sales` real DEFAULT 0 NOT NULL,
	`mobile_sales` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);


-- Table: credit_ledger
CREATE TABLE `credit_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`balance_after` real NOT NULL,
	`description` text,
	`sale_id` text,
	`voucher_image_url` text,
	`timestamp` text NOT NULL,
	`created_by` text, `created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);


-- Table: customers
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`barcode` text,
	`member_id` text,
	`image_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`credit_limit` real DEFAULT 0 NOT NULL,
	`current_balance` real DEFAULT 0 NOT NULL,
	`loyalty_points` integer DEFAULT 0 NOT NULL,
	`risk_tag` text DEFAULT 'low' NOT NULL
, `created_at` text NOT NULL, `updated_at` text NOT NULL);


-- Table: expenses
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`description` text,
	`receipt_image_url` text,
	`note` text,
	`timestamp` text NOT NULL
);


-- Table: inventory_logs
CREATE TABLE `inventory_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`type` text NOT NULL,
	`quantity_changed` integer NOT NULL,
	`previous_stock` integer NOT NULL,
	`current_stock` integer NOT NULL,
	`staff_id` text,
	`staff_name` text,
	`reason` text,
	`timestamp` text NOT NULL, `created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);


-- Table: products
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`cost` real DEFAULT 0,
	`barcode` text,
	`image_data` text,
	`image_url` text,
	`stock` integer DEFAULT 0 NOT NULL,
	`min_stock_level` integer DEFAULT 0 NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`category` text,
	`status` text DEFAULT 'active' NOT NULL
, `created_at` text NOT NULL, `updated_at` text NOT NULL);


-- Table: sale_items
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`total` real NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);


-- Table: sales
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`subtotal` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`tax` real NOT NULL,
	`total` real NOT NULL,
	`payment_method` text NOT NULL,
	`payment_status` text DEFAULT 'paid' NOT NULL,
	`customer_id` text,
	`store_id` text,
	`timestamp` text NOT NULL,
	`created_by` text,
	`payment_slip_url` text, `staff_id` text, `created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);


-- Table: shifts
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`staff_id` text NOT NULL,
	`staff_name` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`opening_cash` real NOT NULL,
	`closing_cash` real,
	`status` text NOT NULL,
	`total_sales` real DEFAULT 0 NOT NULL,
	`cash_sales` real DEFAULT 0 NOT NULL,
	`card_sales` real DEFAULT 0 NOT NULL,
	`credit_sales` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL, `mobile_sales` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);


-- Table: staff
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pin` text NOT NULL,
	`role` text NOT NULL,
	`barcode` text,
	`status` text DEFAULT 'active' NOT NULL
, created_at TEXT DEFAULT '2024-01-01 00:00:00', updated_at TEXT DEFAULT '2024-01-01 00:00:00');


-- Table: __drizzle_migrations
CREATE TABLE "__drizzle_migrations" (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			);




-- Data for app_settings (1 records)
-- Record 1
INSERT INTO app_settings (id, store_name, store_address, store_phone, store_logo_url, ai_image_recognition_enabled, enable_tax, tax_percentage, gemini_api_key, groq_api_key, enable_mobile_scanner, enable_photo_capture, currency_code, currency_symbol, currency_position, updated_at, enable_local_ai, local_ai_url, local_ai_model) VALUES (1, 'My Store', '', '', NULL, 1, 0, 0, 'AIzaSyANLmRwuIQVHWRST1rWpfZCYUUdqSctjKc', '', 1, 1, 'MMK', 'K', 'after', '2026-01-11T02:34:10.109Z', 1, '', NULL);


-- Data for attendance (1 records)
-- Record 1
INSERT INTO attendance (id, staff_id, staff_name, date, clock_in_time, clock_out_time, total_hours, opening_cash, total_sales, cash_sales, card_sales, credit_sales, mobile_sales) VALUES ('80c1c894-f7ac-44d3-83b6-61cb79ae293b', 'ff684a5f-9c34-4b06-87a5-7a5f35ea8445', 'Admin', '2026-01-09', '2026-01-09T08:21:01.239Z', '', 0, 0, 0, 0, 0, 0, 0);


-- Data for staff (1 records)
-- Record 1
INSERT INTO staff (id, name, pin, role, barcode, status, created_at, updated_at) VALUES ('ff684a5f-9c34-4b06-87a5-7a5f35ea8445', 'Admin', 'c0f5575f3b329d1893ffe7d4fc894ecd:baccffd6e30f1daa42d2b315c447646ede79e4addf83ec3cc912920bf5dea543945a650f26ed990519dab2624bda6fa9f552608a864a00efbf326983ec4af8bd', 'owner', NULL, 'active', '2024-01-01 00:00:00', '2024-01-01 00:00:00');

