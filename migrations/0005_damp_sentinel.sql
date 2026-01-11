PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`description` text,
	`receipt_image_url` text,
	`note` text,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_expenses`("id", "category", "amount", "date", "description", "receipt_image_url", "note", "timestamp") SELECT "id", "category", "amount", "date", "description", "receipt_image_url", "note", "timestamp" FROM `expenses`;--> statement-breakpoint
DROP TABLE `expenses`;--> statement-breakpoint
ALTER TABLE `__new_expenses` RENAME TO `expenses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `enable_local_ai` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `local_ai_url` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `local_ai_model` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `groq_api_key` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `currency_code` text DEFAULT 'MMK' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `currency_symbol` text DEFAULT 'K' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `currency_position` text DEFAULT 'after' NOT NULL;--> statement-breakpoint
ALTER TABLE `credit_ledger` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `updated_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory_logs` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `updated_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `sales` ADD `staff_id` text;--> statement-breakpoint
ALTER TABLE `sales` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `mobile_sales` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `staff` ADD `created_at` text NOT NULL;--> statement-breakpoint
ALTER TABLE `staff` ADD `updated_at` text NOT NULL;