CREATE TABLE `integrations` (
	`user_id` text PRIMARY KEY NOT NULL,
	`encrypted` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `refresh_locks` (
	`user_id` text PRIMARY KEY NOT NULL,
	`until_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fetched_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `snapshot_user_date` ON `snapshots` (`user_id`,`fetched_at`);