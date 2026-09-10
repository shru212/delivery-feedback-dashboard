CREATE TABLE `report_artifacts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);
