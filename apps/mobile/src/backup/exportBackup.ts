import type { AppDb } from "@/db/types";
import type { ImageStore } from "@/images/store";
import type { PrefsStore } from "@/prefs/prefs";

import { type ByteSink, createArchiveWriter } from "./container";
import { SCHEMA_VERSION, collectSnapshot } from "./snapshot";

const PAGES_PREFIX = "pages/";

export async function exportBackup(deps: {
  db: AppDb;
  prefs: PrefsStore;
  store: ImageStore;
  sink: ByteSink;
  passphrase: string | null;
  now: number;
  appVersion: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ pages: number; missing: string[] }> {
  const { db, prefs, store, sink, passphrase, now, appVersion, onProgress } = deps;
  try {
    const snap = collectSnapshot(db, prefs);
    const wanted = new Set<string>();
    for (const p of snap.receiptPages) {
      if (p.deletedAt !== null) continue;
      wanted.add(p.imagePath);
      if (p.thumbPath) wanted.add(p.thumbPath);
    }
    // Pre-pass: the manifest must list exactly the pages that will be written.
    const present: string[] = [];
    const missing: string[] = [];
    for (const path of wanted) ((await store.exists(path)) ? present : missing).push(path);
    const nameOf = (path: string) => path.slice(PAGES_PREFIX.length);

    const writer = await createArchiveWriter(sink, { passphrase });
    await writer.manifest({
      createdAt: now,
      appVersion,
      schemaVersion: SCHEMA_VERSION,
      pageNames: present.map(nameOf),
      missing,
      counts: {
        receipts: snap.receipts.length,
        pages: snap.receiptPages.length,
        categories: snap.categories.length,
        folders: snap.folders.length,
        lineItems: snap.lineItems.length,
      },
    });
    await writer.snapshot(snap);
    onProgress?.(0, present.length);
    let done = 0;
    for (const path of present) {
      // A failure here (decrypt error, file vanished) aborts: never a silently incomplete archive.
      await writer.page(nameOf(path), await store.readPlain(path));
      onProgress?.(++done, present.length);
    }
    await writer.finish();
    return { pages: present.length, missing };
  } catch (e) {
    await sink.close().catch(() => undefined);
    throw e;
  }
}
