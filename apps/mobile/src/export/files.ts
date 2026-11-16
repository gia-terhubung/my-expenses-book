import * as Sharing from "expo-sharing";

import type { FileOps } from "../images/store";

/** Under cacheDir. Plaintext exports live only here; purged on cold start, never on background. */
export const EXPORT_DIR = "export/";
/** expo-document-picker's cache copy of a picked backup. */
const PICKER_DIR = "DocumentPicker/";
/** expo-print's temp output (a plaintext PDF left behind if the app dies mid-render). */
const PRINT_DIR = "Print/";

export type ExportKind = "csv" | "pdf" | "meb" | "txt";

export function exportFileName(kind: ExportKind, localDate: string): string {
  return kind === "meb" ? `MyExpensesBook-backup-${localDate}.meb` : `MyExpensesBook-${localDate}.${kind}`;
}

/** Cold start only: every plaintext export / picked-backup / print leftover. */
export async function purgeExportFiles(fs: FileOps): Promise<void> {
  await Promise.all([
    fs.removeDir(fs.cacheDir + EXPORT_DIR),
    fs.removeDir(fs.cacheDir + PICKER_DIR),
    fs.removeDir(fs.cacheDir + PRINT_DIR),
  ]);
}

/**
 * Before a new export: clears earlier exports only. Never touches the picker copy, which a
 * restore in progress may still be reading.
 */
export async function purgeExportDir(fs: FileOps): Promise<void> {
  await fs.removeDir(fs.cacheDir + EXPORT_DIR);
}

const SHARE: Record<ExportKind, { mimeType: string; UTI: string }> = {
  csv: { mimeType: "text/csv", UTI: "public.comma-separated-values-text" },
  pdf: { mimeType: "application/pdf", UTI: "com.adobe.pdf" },
  meb: { mimeType: "application/octet-stream", UTI: "public.data" },
  txt: { mimeType: "text/plain", UTI: "public.plain-text" },
};

export async function shareFile(uri: string, kind: ExportKind): Promise<void> {
  await Sharing.shareAsync(uri, SHARE[kind]);
}
