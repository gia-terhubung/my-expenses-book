import { File, FileMode } from "expo-file-system";

import type { ByteSink, ByteSource } from "./container";

/** Thin adapters over expo-file-system FileHandle; device-verified, not unit-tested. */
export function fileOpsSink(uri: string): ByteSink {
  const file = new File(uri);
  const parent = file.parentDirectory;
  if (!parent.exists) parent.create({ intermediates: true, idempotent: true });
  file.create({ overwrite: true });
  const handle = file.open(FileMode.Truncate);
  return {
    write: (b) => handle.writeBytes(b),
    close: async () => handle.close(),
  };
}

export function fileSource(uri: string): ByteSource {
  const handle = new File(uri).open(FileMode.ReadOnly);
  return {
    read: (n) => handle.readBytes(n),
    close: async () => handle.close(),
  };
}
