CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` text,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_log_person_action_idx` ON `audit_log` (`person_id`,`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `pixels` (
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`color_index` integer NOT NULL,
	`person_id` text NOT NULL,
	`placed_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`x`, `y`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `posts` DROP COLUMN `archived_at`;