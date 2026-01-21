CREATE TABLE `kitchen_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`business_unit_id` text NOT NULL,
	`table_id` text,
	`table_number` text,
	`items` text,
	`status` text DEFAULT 'in_preparation' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_products` (
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
	`status` text DEFAULT 'active' NOT NULL,
	`is_daily_special` integer DEFAULT false NOT NULL,
	`is_standard_menu` integer DEFAULT false NOT NULL,
	`business_unit_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "price", "cost", "barcode", "image_data", "image_url", "stock", "min_stock_level", "unit", "category", "status", "is_daily_special", "is_standard_menu", "business_unit_id", "created_at", "updated_at") SELECT "id", "name", "price", "cost", "barcode", "image_data", "image_url", "stock", "min_stock_level", "unit", "category", "status", "is_daily_special", "is_standard_menu", "business_unit_id", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode_unique` ON `products` (`barcode`);--> statement-breakpoint
CREATE TABLE `__new_staff` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pin` text NOT NULL,
	`role` text NOT NULL,
	`barcode` text,
	`status` text DEFAULT 'active' NOT NULL,
	`business_unit_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_staff`("id", "name", "pin", "role", "barcode", "status", "business_unit_id", "created_at", "updated_at") SELECT "id", "name", "pin", "role", "barcode", "status", "business_unit_id", "created_at", "updated_at" FROM `staff`;--> statement-breakpoint
DROP TABLE `staff`;--> statement-breakpoint
ALTER TABLE `__new_staff` RENAME TO `staff`;--> statement-breakpoint
CREATE UNIQUE INDEX `staff_barcode_unique` ON `staff` (`barcode`);--> statement-breakpoint
ALTER TABLE `app_settings` ADD `mobile_payment_qr_url` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `delivery_rider_pin` text DEFAULT '8888';--> statement-breakpoint
ALTER TABLE `attendance` ADD `business_unit_id` text REFERENCES business_units(id);--> statement-breakpoint
ALTER TABLE `credit_ledger` ADD `transaction_type` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `due_date` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `credit_due_date` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `monthly_closing_day` integer;--> statement-breakpoint
ALTER TABLE `customers` ADD `business_unit_id` text REFERENCES business_units(id);--> statement-breakpoint
ALTER TABLE `sales` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `order_type` text DEFAULT 'dine-in' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `customer_name` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `customer_phone` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `delivery_address` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `requested_delivery_time` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `payment_proof_url` text;--> statement-breakpoint
ALTER TABLE `shifts` ADD `business_unit_id` text NOT NULL REFERENCES business_units(id);--> statement-breakpoint
ALTER TABLE `tables` ADD `current_order` text;--> statement-breakpoint
ALTER TABLE `tables` ADD `last_ordered` text;--> statement-breakpoint
ALTER TABLE `tables` ADD `service_status` text;