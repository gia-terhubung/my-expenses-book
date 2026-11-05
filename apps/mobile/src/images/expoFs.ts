import { Directory, File, Paths } from "expo-file-system";

import type { FileOps } from "./store";

const withSlash = (u: string) => (u.endsWith("/") ? u : u + "/");

function ensureParent(file: File): void {
  const parent = file.parentDirectory;
  if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
}

export const expoFs: FileOps = {
  documentDir: withSlash(Paths.document.uri),
  cacheDir: withSlash(Paths.cache.uri),
  read: (uri) => new File(uri).bytes(),
  async write(uri, bytes) {
    const f = new File(uri);
    ensureParent(f);
    await f.write(bytes);
  },
  async remove(uri) {
    const f = new File(uri);
    if (f.exists) f.delete();
  },
  async list(dirUri) {
    const d = new Directory(dirUri);
    return d.exists ? d.list().map((e) => e.name) : [];
  },
  async removeDir(dirUri) {
    const d = new Directory(dirUri);
    if (d.exists) d.delete();
  },
};

/** Sync delete of every encrypted page (used by the confirmed "erase all local data" reset). */
export function deletePagesDir(): void {
  const d = new Directory(expoFs.documentDir + "pages/");
  if (d.exists) d.delete();
}
