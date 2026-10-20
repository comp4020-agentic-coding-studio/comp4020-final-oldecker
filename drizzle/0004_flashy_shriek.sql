CREATE TABLE `party_guests` (
	`person_id` text PRIMARY KEY NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
