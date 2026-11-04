CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name_key` text,
	`custom_name` text,
	`icon` text,
	`color` text,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`default_currency` text
);
--> statement-breakpoint
CREATE TABLE `line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`receipt_id` text NOT NULL,
	`description` text NOT NULL,
	`qty` integer,
	`amount_minor` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `line_items_receipt_id_idx` ON `line_items` (`receipt_id`);--> statement-breakpoint
CREATE TABLE `receipt_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`receipt_id` text NOT NULL,
	`page_index` integer NOT NULL,
	`image_path` text NOT NULL,
	`thumb_path` text,
	`width` integer,
	`height` integer
);
--> statement-breakpoint
CREATE INDEX `receipt_pages_receipt_id_idx` ON `receipt_pages` (`receipt_id`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`merchant` text,
	`purchased_at_local` text NOT NULL,
	`purchased_tz` text,
	`purchased_at_utc` integer NOT NULL,
	`scanned_at_utc` integer NOT NULL,
	`scanned_tz` text,
	`currency` text NOT NULL,
	`total_minor` integer NOT NULL,
	`tax_minor` integer,
	`fx_rate` text,
	`fx_rate_date` text,
	`home_currency_at_save` text,
	`amount_home_minor` integer,
	`fx_approximate` integer DEFAULT false NOT NULL,
	`category_id` text,
	`folder_id` text,
	`notes` text,
	`raw_ocr_text` text,
	`parse_source` text NOT NULL,
	`parse_confidence` text,
	`status` text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `receipts_purchased_at_utc_idx` ON `receipts` (`purchased_at_utc`);--> statement-breakpoint
CREATE INDEX `receipts_folder_id_idx` ON `receipts` (`folder_id`);--> statement-breakpoint
CREATE INDEX `receipts_category_id_idx` ON `receipts` (`category_id`);