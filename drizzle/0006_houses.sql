-- Houses: everything shared becomes per house, and everything that already
-- exists moves into the first one. Hand-edited from drizzle-kit's output,
-- which can't backfill: it adds NOT NULL columns with no default (fails on
-- any non-empty table) and copies a house_id the old tables don't have.
--
-- Every table that gains house_id is REBUILT (create __new_x, copy with
-- house_id = 1, drop, rename) rather than ALTERed: SQLite can't change a
-- primary key, and can't ADD a NOT NULL REFERENCES column without a
-- default. Nothing is deleted --- each INSERT ... SELECT copies every row.
-- Foreign keys are switched off around this migration by src/lib/db.ts
-- (a PRAGMA in here would be a no-op inside the migrator's transaction),
-- and checked with foreign_key_check straight after.
CREATE TABLE `houses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`invite_code` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `houses_slug_unique` ON `houses` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `houses_invite_code_unique` ON `houses` (`invite_code`);--> statement-breakpoint
-- The first house. Its invite code is generated here, at migration time, so
-- no working code is ever written into this (public) repo.
INSERT INTO `houses` (`id`, `slug`, `name`, `invite_code`) VALUES (1, 'the-board', 'the board', lower(hex(randomblob(9))));--> statement-breakpoint
CREATE TABLE `house_members` (
	`house_id` integer NOT NULL,
	`person_id` text NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`house_id`, `person_id`),
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `house_members_person_idx` ON `house_members` (`person_id`);--> statement-breakpoint
-- Every real account (one with a password) lives in the first house. Legacy
-- no-password rows can't log in, so they need no membership; their posts
-- still render, because posts belong to the house, not to the author.
INSERT INTO `house_members` (`house_id`, `person_id`) SELECT 1, `id` FROM `people` WHERE `password_hash` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `last_house_id` integer;--> statement-breakpoint
UPDATE `people` SET `last_house_id` = 1 WHERE `password_hash` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`house_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`category` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_posts` (`id`, `house_id`, `author_id`, `category`, `body`, `created_at`) SELECT `id`, 1, `author_id`, `category`, `body`, `created_at` FROM `posts`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
CREATE TABLE `__new_waterings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`house_id` integer NOT NULL,
	`person_id` text NOT NULL,
	`watered_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_waterings` (`id`, `house_id`, `person_id`, `watered_at`) SELECT `id`, 1, `person_id`, `watered_at` FROM `waterings`;--> statement-breakpoint
DROP TABLE `waterings`;--> statement-breakpoint
ALTER TABLE `__new_waterings` RENAME TO `waterings`;--> statement-breakpoint
CREATE INDEX `waterings_house_time_idx` ON `waterings` (`house_id`,`watered_at`);--> statement-breakpoint
CREATE TABLE `__new_plant` (
	`id` integer PRIMARY KEY NOT NULL,
	`house_id` integer NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_plant` (`id`, `house_id`, `name`, `updated_at`) SELECT `id`, 1, `name`, `updated_at` FROM `plant`;--> statement-breakpoint
DROP TABLE `plant`;--> statement-breakpoint
ALTER TABLE `__new_plant` RENAME TO `plant`;--> statement-breakpoint
CREATE UNIQUE INDEX `plant_house_id_unique` ON `plant` (`house_id`);--> statement-breakpoint
CREATE TABLE `__new_canvas_meta` (
	`id` integer PRIMARY KEY NOT NULL,
	`house_id` integer NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_canvas_meta` (`id`, `house_id`, `name`, `updated_at`) SELECT `id`, 1, `name`, `updated_at` FROM `canvas_meta`;--> statement-breakpoint
DROP TABLE `canvas_meta`;--> statement-breakpoint
ALTER TABLE `__new_canvas_meta` RENAME TO `canvas_meta`;--> statement-breakpoint
CREATE UNIQUE INDEX `canvas_meta_house_id_unique` ON `canvas_meta` (`house_id`);--> statement-breakpoint
CREATE TABLE `__new_pixels` (
	`house_id` integer NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`color_index` integer NOT NULL,
	`person_id` text NOT NULL,
	`placed_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`house_id`, `x`, `y`),
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_pixels` (`house_id`, `x`, `y`, `color_index`, `person_id`, `placed_at`) SELECT 1, `x`, `y`, `color_index`, `person_id`, `placed_at` FROM `pixels`;--> statement-breakpoint
DROP TABLE `pixels`;--> statement-breakpoint
ALTER TABLE `__new_pixels` RENAME TO `pixels`;--> statement-breakpoint
CREATE TABLE `__new_party_guests` (
	`house_id` integer NOT NULL,
	`person_id` text NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`house_id`, `person_id`),
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_party_guests` (`house_id`, `person_id`, `joined_at`, `expires_at`) SELECT 1, `person_id`, `joined_at`, `expires_at` FROM `party_guests`;--> statement-breakpoint
DROP TABLE `party_guests`;--> statement-breakpoint
ALTER TABLE `__new_party_guests` RENAME TO `party_guests`;
