CREATE TABLE IF NOT EXISTS `business_units` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`settings` text,
	`is_active` text DEFAULT 'true' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tables` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`capacity` integer NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`business_unit_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint