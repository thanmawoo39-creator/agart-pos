CREATE TABLE IF NOT EXISTS `alerts` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `app_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`store_name` text DEFAULT 'My Store' NOT NULL,
	`store_address` text,
	`store_phone` text,
	`store_logo_url` text,
	`ai_image_recognition_enabled` integer DEFAULT false NOT NULL,
	`enable_tax` integer DEFAULT false NOT NULL,
	`tax_percentage` real DEFAULT 0 NOT NULL,
	`gemini_api_key` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `attendance` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `credit_ledger` (
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
	`created_by` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`barcode` text,
	`image_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`credit_limit` real DEFAULT 0 NOT NULL,
	`current_balance` real DEFAULT 0 NOT NULL,
	`loyalty_points` integer DEFAULT 0 NOT NULL,
	`risk_tag` text DEFAULT 'low' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customers_barcode_unique` ON `customers` (`barcode`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`staff_id` text,
	`staff_name` text,
	`note` text,
	`receipt_image_url` text,
	`timestamp` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `inventory_logs` (
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
	`timestamp` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `products` (
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
	`category` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `products_barcode_unique` ON `products` (`barcode`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sale_items` (
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`items` text NOT NULL,
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
	`payment_slip_url` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `shifts` (
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
	`created_at` text NOT NULL,
	FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pin` text NOT NULL,
	`role` text NOT NULL,
	`barcode` text,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `staff_barcode_unique` ON `staff` (`barcode`);