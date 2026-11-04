CREATE VIRTUAL TABLE `receipts_fts` USING fts5(
	merchant,
	notes,
	raw_ocr_text,
	content='receipts',
	content_rowid='rowid',
	tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `receipts_fts_ai` AFTER INSERT ON `receipts` BEGIN
	INSERT INTO receipts_fts(rowid, merchant, notes, raw_ocr_text)
	VALUES (new.rowid, new.merchant, new.notes, new.raw_ocr_text);
END;
--> statement-breakpoint
CREATE TRIGGER `receipts_fts_ad` AFTER DELETE ON `receipts` BEGIN
	INSERT INTO receipts_fts(receipts_fts, rowid, merchant, notes, raw_ocr_text)
	VALUES ('delete', old.rowid, old.merchant, old.notes, old.raw_ocr_text);
END;
--> statement-breakpoint
CREATE TRIGGER `receipts_fts_au` AFTER UPDATE ON `receipts` BEGIN
	INSERT INTO receipts_fts(receipts_fts, rowid, merchant, notes, raw_ocr_text)
	VALUES ('delete', old.rowid, old.merchant, old.notes, old.raw_ocr_text);
	INSERT INTO receipts_fts(rowid, merchant, notes, raw_ocr_text)
	VALUES (new.rowid, new.merchant, new.notes, new.raw_ocr_text);
END;
--> statement-breakpoint
INSERT INTO receipts_fts(receipts_fts) VALUES ('rebuild');
--> statement-breakpoint
INSERT INTO `categories` (`id`, `created_at`, `updated_at`, `version`, `name_key`, `icon`, `is_default`) VALUES
	('default:food_drink', 0, 0, 1, 'food_drink', 'fork.knife', 1),
	('default:transport', 0, 0, 1, 'transport', 'car', 1),
	('default:lodging', 0, 0, 1, 'lodging', 'bed.double', 1),
	('default:groceries', 0, 0, 1, 'groceries', 'cart', 1),
	('default:shopping', 0, 0, 1, 'shopping', 'bag', 1),
	('default:utilities', 0, 0, 1, 'utilities', 'bolt', 1),
	('default:health', 0, 0, 1, 'health', 'cross.case', 1),
	('default:office', 0, 0, 1, 'office', 'briefcase', 1),
	('default:entertainment', 0, 0, 1, 'entertainment', 'ticket', 1),
	('default:other', 0, 0, 1, 'other', 'ellipsis.circle', 1);
