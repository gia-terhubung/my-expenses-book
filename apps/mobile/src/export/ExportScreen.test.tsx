import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createFolder } from "@/db/repositories/folders";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import type { FileOps } from "@/images/store";

import { ExportScreen } from "./ExportScreen";

let mockDb: AppDb;
let mockParams: Record<string, string> = {};
const mockRouter = { back: jest.fn() };
const mockShare = jest.fn();
jest.mock("expo-sharing", () => ({ shareAsync: (...a: unknown[]) => mockShare(...a) }));
jest.mock("expo-print", () => ({ printToFileAsync: jest.fn() }));
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => ({ readPlain: async () => new Uint8Array() }) }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => (k === "taxYearStartMonth" ? 1 : k === "language" ? "en" : "IDR"),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({
  router: { back: () => mockRouter.back() },
  useLocalSearchParams: () => mockParams,
}));

function seed(merchant: string, local: string, totalMinor: number, folderId: string | null = null) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant,
    purchasedAtLocal: local,
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 4, 1),
    scannedAtUtc: Date.UTC(2026, 4, 1),
    currency: "IDR",
    totalMinor,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: totalMinor,
    parseSource: "manual",
    folderId,
  });
}

function fakeFs(failWrite = false) {
  const files = new Map<string, Uint8Array>();
  const fs = {
    documentDir: "file:///doc/",
    cacheDir: "file:///cache/",
    write: async (u: string, b: Uint8Array) => {
      if (failWrite) throw new Error("disk full");
      files.set(u, b);
    },
    removeDir: jest.fn(async () => undefined),
  } as unknown as FileOps;
  return { fs, files };
}

const today = () => new Date(2026, 10, 7, 12);

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  mockParams = {};
  jest.clearAllMocks();
  mockShare.mockResolvedValue(undefined);
});

describe("ExportScreen", () => {
  it("shows count and home total for the selection", async () => {
    seed("A", "2026-05-10T10:00:00", 50000);
    seed("B", "2026-06-10T10:00:00", 25000);
    const { fs } = fakeFs();
    await render(<ExportScreen fs={fs} now={today} />);
    await fireEvent.press(screen.getByRole("radio", { name: "All time" }));
    expect(await screen.findByText(/2 receipts · .*750/)).toBeTruthy();
  });

  it("zero matches disables Export and shows the empty copy", async () => {
    const { fs } = fakeFs();
    await render(<ExportScreen fs={fs} now={today} />);
    await fireEvent.press(screen.getByRole("radio", { name: "All time" }));
    expect(screen.getByText("No receipts match this selection.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export" }).props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Export" }));
    expect(mockShare).not.toHaveBeenCalled();
  });

  it("CSV export purges, writes cache/export file, then shares text/csv", async () => {
    seed("Warung", "2026-05-10T10:00:00", 50000);
    const { fs, files } = fakeFs();
    await render(<ExportScreen fs={fs} now={today} />);
    await fireEvent.press(screen.getByRole("radio", { name: "All time" }));
    await fireEvent.press(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    const uri = "file:///cache/export/MyExpensesBook-2026-11-07.csv";
    expect(mockShare).toHaveBeenCalledWith(uri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
    expect(fs.removeDir).toHaveBeenCalled();
    const text = Buffer.from(files.get(uri)!).toString("utf8");
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toContain("Warung");
    expect(text).toContain("Merchant");
  });

  it("folderId param preselects the folder", async () => {
    const f = createFolder(mockDb, { name: "Bali", kind: "trip" });
    seed("In", "2026-05-10T10:00:00", 70000, f.id);
    seed("Out", "2026-05-11T10:00:00", 10000);
    mockParams = { folderId: f.id, from: "2026-01-01", to: "2026-12-31" };
    const { fs } = fakeFs();
    await render(<ExportScreen fs={fs} now={today} />);
    expect(await screen.findByText(/1 receipt · .*700/)).toBeTruthy();
    expect(screen.getByText("Bali")).toBeTruthy();
  });

  it("write failure shows the error panel and does not share", async () => {
    seed("A", "2026-05-10T10:00:00", 50000);
    const { fs } = fakeFs(true);
    await render(<ExportScreen fs={fs} now={today} />);
    await fireEvent.press(screen.getByRole("radio", { name: "All time" }));
    await fireEvent.press(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByText("Export failed")).toBeTruthy();
    expect(mockShare).not.toHaveBeenCalled();
  });
});
