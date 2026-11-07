import type { FileOps } from "../images/store";
import { EXPORT_DIR, exportFileName, purgeExportDir, purgeExportFiles, shareFile } from "./files";

const mockShare = jest.fn();
jest.mock("expo-sharing", () => ({ shareAsync: (...a: unknown[]) => mockShare(...a) }));

describe("exportFileName", () => {
  it("names each kind", () => {
    expect(exportFileName("csv", "2026-11-07")).toBe("MyExpensesBook-2026-11-07.csv");
    expect(exportFileName("pdf", "2026-11-07")).toBe("MyExpensesBook-2026-11-07.pdf");
    expect(exportFileName("meb", "2026-11-07")).toBe("MyExpensesBook-backup-2026-11-07.meb");
  });
});

describe("purgeExportFiles (cold start)", () => {
  it("removes cache/export, cache/DocumentPicker and cache/Print only", async () => {
    const removed: string[] = [];
    const fs = { cacheDir: "file:///cache/", removeDir: async (d: string) => void removed.push(d) } as unknown as FileOps;
    await purgeExportFiles(fs);
    expect(EXPORT_DIR).toBe("export/");
    expect(removed.sort()).toEqual(["file:///cache/DocumentPicker/", "file:///cache/Print/", "file:///cache/export/"]);
  });
});

describe("purgeExportDir (before a new export)", () => {
  it("removes cache/export only, never a picked backup", async () => {
    const removed: string[] = [];
    const fs = { cacheDir: "file:///cache/", removeDir: async (d: string) => void removed.push(d) } as unknown as FileOps;
    await purgeExportDir(fs);
    expect(removed).toEqual(["file:///cache/export/"]);
  });
});

describe("shareFile", () => {
  beforeEach(() => mockShare.mockReset());
  it.each([
    ["csv", "text/csv", "public.comma-separated-values-text"],
    ["pdf", "application/pdf", "com.adobe.pdf"],
    ["meb", "application/octet-stream", "public.data"],
  ] as const)("shares %s", async (kind, mimeType, UTI) => {
    await shareFile("file:///x", kind);
    expect(mockShare).toHaveBeenCalledWith("file:///x", { mimeType, UTI });
  });
});
