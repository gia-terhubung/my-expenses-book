CREATE TABLE `recurring_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`merchant` text,
	`currency` text NOT NULL,
	`total_minor` integer NOT NULL,
	`tax_minor` integer,
	`category_id` text,
	`folder_id` text,
	`notes` text,
	`frequency` text NOT NULL,
	`anchor_date` text NOT NULL,
	`month_day` integer,
	`tz` text NOT NULL,
	`auto_add` integer NOT NULL,
	`end_date` text,
	`paused` integer DEFAULT false NOT NULL,
	`last_generated_date` text
);
--> statement-breakpoint
ALTER TABLE `receipts` ADD `recurring_rule_id` text;--> statement-breakpoint
ALTER TABLE `receipts` ADD `recurring_date` text;--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_recurring_occurrence_uq` ON `receipts` (`recurring_rule_id`,`recurring_date`) WHERE deleted_at IS NULL AND recurring_rule_id IS NOT NULL;