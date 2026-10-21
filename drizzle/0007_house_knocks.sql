CREATE TABLE `house_knocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`house_id` integer NOT NULL,
	`person_id` text NOT NULL,
	`outcome` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`answered_at` integer,
	`answered_by` text,
	`seen_at` integer,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`answered_by`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `house_knocks_one_pending` ON `house_knocks` (`house_id`,`person_id`) WHERE "house_knocks"."outcome" = 'pending';--> statement-breakpoint
CREATE INDEX `house_knocks_person_idx` ON `house_knocks` (`person_id`);