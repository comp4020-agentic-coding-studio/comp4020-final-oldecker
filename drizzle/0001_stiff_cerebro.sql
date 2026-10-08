CREATE TABLE `plant` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
