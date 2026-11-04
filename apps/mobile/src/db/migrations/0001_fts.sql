-- !!! FTS WARNING !!!
-- Any migration that rebuilds `receipts` (drizzle-kit recreate pattern: CREATE
-- __new_receipts; INSERT..SELECT; DROP receipts; RENAME) drops the triggers
-- below and may change rowids. It MUST re-create receipts_fts_ai/_ad/_au and
-- then run: INSERT INTO receipts_fts(receipts_fts) VALUES('rebuild');
-- The same applies to any restore path that copies receipt rows.
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
INSERT INTO `categories` (`id`, `created_at`, `updated_at`, `version`, `sort_order`, `name_key`, `icon`, `is_default`) VALUES
	('default:food_drink', 0, 0, 1, 10, 'food_drink', 'fork.knife', 1),
	('default:transport', 0, 0, 1, 20, 'transport', 'car', 1),
	('default:lodging', 0, 0, 1, 30, 'lodging', 'bed.double', 1),
	('default:groceries', 0, 0, 1, 40, 'groceries', 'cart', 1),
	('default:shopping', 0, 0, 1, 50, 'shopping', 'bag', 1),
	('default:utilities', 0, 0, 1, 60, 'utilities', 'bolt', 1),
	('default:health', 0, 0, 1, 70, 'health', 'cross.case', 1),
	('default:office', 0, 0, 1, 80, 'office', 'briefcase', 1),
	('default:entertainment', 0, 0, 1, 90, 'entertainment', 'ticket', 1),
	('default:other', 0, 0, 1, 100, 'other', 'ellipsis.circle', 1);
