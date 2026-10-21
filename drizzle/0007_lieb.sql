CREATE TABLE `lieb_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`house_id` integer NOT NULL,
	`from_person_id` text NOT NULL,
	`to_person_id` text NOT NULL,
	`day` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`seen_at` integer,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lieb_once_a_day` ON `lieb_messages` (`from_person_id`,`to_person_id`,`day`);--> statement-breakpoint
CREATE INDEX `lieb_inbox_idx` ON `lieb_messages` (`house_id`,`to_person_id`,`seen_at`);