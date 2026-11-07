import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { notifyDataChanged } from "../changes";
import { newId, now } from "../ids";
import { folders, receipts } from "../schema";
import type { AppDb, Folder } from "../types";
import type { FolderKind } from "../schema";

export function createFolder(
  db: AppDb,
  input: { name: string; kind: FolderKind; defaultCurrency?: string },
): Folder {
  const t = now();
  const row = db
    .insert(folders)
    .values({
      id: newId(),
      name: input.name,
      kind: input.kind,
      defaultCurrency: input.defaultCurrency ?? null,
      createdAt: t,
      updatedAt: t,
    })
    .returning()
    .get();
  notifyDataChanged();
  return row;
}

export function listFolders(db: AppDb): Folder[] {
  return db
    .select()
    .from(folders)
    .where(isNull(folders.deletedAt))
    .orderBy(asc(folders.name), asc(folders.id))
    .all();
}

export function renameFolder(db: AppDb, id: string, name: string): Folder {
  const row = db
    .update(folders)
    .set({ name, updatedAt: now(), version: sql`${folders.version} + 1` })
    .where(and(eq(folders.id, id), isNull(folders.deletedAt)))
    .returning()
    .get();
  if (!row) throw new Error(`Folder not found: ${id}`);
  notifyDataChanged();
  return row;
}

/** Soft-deletes the folder and detaches its receipts (folder_id = null). */
export function softDeleteFolder(db: AppDb, id: string): void {
  const t = now();
  db.transaction((tx) => {
    tx.update(receipts)
      .set({ folderId: null, updatedAt: t, version: sql`${receipts.version} + 1` })
      .where(eq(receipts.folderId, id))
      .run();
    tx.update(folders)
      .set({ deletedAt: t, updatedAt: t, version: sql`${folders.version} + 1` })
      .where(and(eq(folders.id, id), isNull(folders.deletedAt)))
      .run();
  });
  notifyDataChanged();
}
