ALTER TABLE `customers` ADD `member_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customers_member_id_unique` ON `customers` (`member_id`);