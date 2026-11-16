import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createFolder } from "@/db/repositories/folders";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import type { FileOps } from "@/images/store";

import { ExportScreen } from "./ExportScreen";

let mockDb: AppDb;
let mockParams: Record<string, string> = {};
let mockTop = 0;
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
  useSafeAreaInsets: () => ({ top: mockTop, bottom: 0, left: 0, right: 0 }),
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
  mockTop = 0;
  jest.clearAllMocks();
  mockShare.mockResolvedValue(undefined);
});

describe("ExportScreen", () => {
  it("keeps the status-bar inset outside the scrolling content (no scroll under the status bar)", async () => {
    mockTop = 40;
    const { fs } = fakeFs();
    await render(<ExportScreen fs={fs} now={today} />);
    const flat = (st: unknown) => Object.assign({}, ...[st].flat(Infinity).filter(Boolean)) as { paddingTop?: number };
    expect(flat(screen.getByTestId("export-scroll").props.contentContainerStyle).paddingTop ?? 0).toBeLessThan(40);
    expect(flat(screen.getByTestId("export-screen").props.style).paddingTop).toBe(40);
  });

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
    expect(text.startsWith("\uFEFF")).toBe(true);
    expect(text).toContain("Warung");
    expect(text).toContain("Merchant");
  });

  it("folderId param alone preselects the folder over all time", async () => {
    const f = createFolder(mockDb, { name: "Bali", kind: "trip" });
    seed("In", "2024-05-10T10:00:00", 70000, f.id); // outside this tax year
    seed("Out", "2026-05-11T10:00:00", 10000);
    mockParams = { folderId: f.id };
    const { fs } = fakeFs();
    await render(<ExportScreen fs={fs} now={today} />);
    expect(await screen.findByText(/1 receipt · .*700/)).toBeTruthy();
    expect(screen.getByText("Bali")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "All time" }).props.accessibilityState?.checked).toBe(true);
  });

  it("folderId with from/to uses that custom range", async () => {
    const f = createFolder(mockDb, { name: "Bali", kind: "trip" });
    seed("Old", "2024-05-10T10:00:00", 30000, f.id);
    seed("In", "2026-05-10T10:00:00", 70000, f.id);
    mockParams = { folderId: f.id, from: "2026-01-01", to: "2026-12-31" };
    const { fs } = fakeFs();
    await render(<ExportScreen fs={fs} now={today} />);
    expect(await screen.findByText(/1 receipt · .*700/)).toBeTruthy();
  });

  it("double tap starts one export", async () => {
    seed("A", "2026-05-10T10:00:00", 50000);
    const { fs } = fakeFs();
    await render(<ExportScreen fs={fs} now={today} />);
    await fireEvent.press(screen.getByRole("radio", { name: "All time" }));
    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Export" }));
      fireEvent.press(screen.getByRole("button", { name: "Export" }));
    });
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(fs.removeDir).toHaveBeenCalledTimes(1);
  });

  it("clears only cache/export before writing", async () => {
    seed("A", "2026-05-10T10:00:00", 50000);
    const { fs } = fakeFs();
    await render(<ExportScreen fs={fs} now={today} />);
    await fireEvent.press(screen.getByRole("radio", { name: "All time" }));
    await fireEvent.press(screen.getByRole("button", { name: "Export" }));
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect((fs.removeDir as jest.Mock).mock.calls).toEqual([["file:///cache/export/"]]);
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
