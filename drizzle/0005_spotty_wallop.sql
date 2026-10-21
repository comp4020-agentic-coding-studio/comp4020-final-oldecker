CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_person_idx` ON `sessions` (`person_id`);--> statement-breakpoint
ALTER TABLE `people` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `people` ADD `name_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `people_name_key_unique` ON `people` (`name_key`);