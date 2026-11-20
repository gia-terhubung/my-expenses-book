import { File } from "expo-file-system";

import type { DbFileOps } from "./safeMigrate";

// expo-sqlite reports plain paths; expo-file-system wants file:// URIs.
const toFile = (path: string) => new File(path.startsWith("file://") ? path : `file://${encodeURI(path)}`);

/** Device DbFileOps on expo-file-system. Copy and move overwrite the destination. */
export const expoDbFiles: DbFileOps = {
  exists: (path) => toFile(path).exists,
  copy(from, to) {
    toFile(from).copySync(toFile(to), { overwrite: true });
  },
  move(from, to) {
    toFile(from).moveSync(toFile(to), { overwrite: true });
  },
  remove(path) {
    const f = toFile(path);
    if (f.exists) f.delete();
  },
};
