CREATE TABLE `wall_gallery` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`house_id` integer NOT NULL,
	`name` text NOT NULL,
	`pixels` text NOT NULL,
	`wiped_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wall_gallery_house_idx` ON `wall_gallery` (`house_id`,`wiped_at`);--> statement-breakpoint
CREATE TABLE `wall_vote_ballots` (
	`vote_id` integer NOT NULL,
	`person_id` text NOT NULL,
	`choice` text NOT NULL,
	`voted_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`vote_id`, `person_id`),
	FOREIGN KEY (`vote_id`) REFERENCES `wall_votes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wall_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`house_id` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`resolves_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wall_votes_one_open` ON `wall_votes` (`house_id`) WHERE "wall_votes"."status" = 'open';--> statement-breakpoint
CREATE INDEX `wall_votes_house_idx` ON `wall_votes` (`house_id`,`created_at`);