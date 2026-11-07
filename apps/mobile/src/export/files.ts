import * as Sharing from "expo-sharing";

import type { FileOps } from "../images/store";

/** Under cacheDir. Plaintext exports live only here; purged on cold start, never on background. */
export const EXPORT_DIR = "export/";
/** expo-document-picker's cache copy of a picked backup. */
const PICKER_DIR = "DocumentPicker/";

export type ExportKind = "csv" | "pdf" | "meb";

export function exportFileName(kind: ExportKind, localDate: string): string {
  return kind === "meb" ? `MyExpensesBook-backup-${localDate}.meb` : `MyExpensesBook-${localDate}.${kind}`;
}

export async function purgeExportFiles(fs: FileOps): Promise<void> {
  await Promise.all([fs.removeDir(fs.cacheDir + EXPORT_DIR), fs.removeDir(fs.cacheDir + PICKER_DIR)]);
}

const SHARE: Record<ExportKind, { mimeType: string; UTI: string }> = {
  csv: { mimeType: "text/csv", UTI: "public.comma-separated-values-text" },
  pdf: { mimeType: "application/pdf", UTI: "com.adobe.pdf" },
  meb: { mimeType: "application/octet-stream", UTI: "public.data" },
};

export async function shareFile(uri: string, kind: ExportKind): Promise<void> {
  await Sharing.shareAsync(uri, SHARE[kind]);
}
