import type { FileOps } from "../images/store";
import { EXPORT_DIR, exportFileName, purgeExportFiles, shareFile } from "./files";

const mockShare = jest.fn();
jest.mock("expo-sharing", () => ({ shareAsync: (...a: unknown[]) => mockShare(...a) }));

describe("exportFileName", () => {
  it("names each kind", () => {
    expect(exportFileName("csv", "2026-11-07")).toBe("MyExpensesBook-2026-11-07.csv");
    expect(exportFileName("pdf", "2026-11-07")).toBe("MyExpensesBook-2026-11-07.pdf");
    expect(exportFileName("meb", "2026-11-07")).toBe("MyExpensesBook-backup-2026-11-07.meb");
  });
});

describe("purgeExportFiles", () => {
  it("removes cache/export and cache/DocumentPicker only", async () => {
    const removed: string[] = [];
    const fs = { cacheDir: "file:///cache/", removeDir: async (d: string) => void removed.push(d) } as unknown as FileOps;
    await purgeExportFiles(fs);
    expect(EXPORT_DIR).toBe("export/");
    expect(removed.sort()).toEqual(["file:///cache/DocumentPicker/", "file:///cache/export/"]);
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
