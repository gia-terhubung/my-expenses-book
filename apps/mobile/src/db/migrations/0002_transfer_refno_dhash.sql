ALTER TABLE `receipt_pages` ADD `dhash` text;--> statement-breakpoint
CREATE INDEX `receipt_pages_dhash_idx` ON `receipt_pages` (`dhash`);--> statement-breakpoint
ALTER TABLE `receipts` ADD `ref_no` text;--> statement-breakpoint
CREATE INDEX `receipts_ref_no_idx` ON `receipts` (`ref_no`);
--> statement-breakpoint
INSERT INTO `categories` (`id`, `created_at`, `updated_at`, `version`, `sort_order`, `name_key`, `icon`, `is_default`) VALUES
	('default:transfer', 0, 0, 1, 95, 'transfer', 'arrow.left.arrow.right', 1);
