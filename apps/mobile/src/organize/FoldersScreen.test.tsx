import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";

import { createFolder, listFolders } from "@/db/repositories/folders";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";

import { FoldersScreen } from "./FoldersScreen";

let mockDb: AppDb;
const mockRouter = { push: jest.fn(), back: jest.fn(), setParams: jest.fn() };
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => (k === "taxYearStartMonth" ? 4 : "IDR"),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));

function seed(
  local: string,
  totalMinor: number,
  folderId: string | null = null,
) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant: "Shop",
    purchasedAtLocal: local,
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 4, 1),
    scannedAtUtc: Date.UTC(2026, 4, 1),
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: totalMinor,
    parseSource: "manual",
    folderId,
  });
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  jest.clearAllMocks();
});

describe("FoldersScreen", () => {
  it("lists tax years newest first with totals", async () => {
    seed("2025-05-10T10:00:00", 10000);
    seed("2026-05-10T10:00:00", 20000);
    await render(<FoldersScreen />);
    expect(screen.getByText("Tax years")).toBeTruthy();
    const rows = screen.getAllByTestId(/^tax-year-row-/);
    expect(rows.map((r) => r.props.testID)).toEqual([
      "tax-year-row-2026",
      "tax-year-row-2025",
    ]);
    expect(screen.getByText("2026/27")).toBeTruthy();
    expect(screen.getByText("2025/26")).toBeTruthy();
    expect(screen.getByText(/200/)).toBeTruthy();
    expect(screen.getByText(/100/)).toBeTruthy();
    await fireEvent.press(rows[0]);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/tax-year/[year]",
      params: { year: "2026" },
    });
  });

  it("lists folders with count and total; row opens the folder", async () => {
    const f = createFolder(mockDb, { name: "Bali", kind: "trip" });
    seed("2026-05-10T10:00:00", 30000, f.id);
    seed("2026-05-11T10:00:00", 30000, f.id);
    await render(<FoldersScreen />);
    expect(screen.getByText("Folders")).toBeTruthy();
    expect(screen.getByText("Bali")).toBeTruthy();
    const row = within(screen.getByTestId(`folder-row-${f.id}`));
    expect(row.getByText("Bali")).toBeTruthy();
    expect(row.getByText("2 receipts")).toBeTruthy();
    expect(row.getByText(/600/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`folder-row-${f.id}`));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/folder/[id]",
      params: { id: f.id },
    });
  });

  it("New folder creates a folder that appears", async () => {
    await render(<FoldersScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "New folder" }));
    await fireEvent.changeText(screen.getByLabelText("Folder name"), "Office");
    await fireEvent.press(screen.getByRole("button", { name: "Create" }));
    expect(listFolders(mockDb).map((f) => f.name)).toEqual(["Office"]);
    expect(await screen.findByText("Office")).toBeTruthy();
  });

  it("a folder row speaks its kind and hides the emoji icon", async () => {
    createFolder(mockDb, { name: "Bali 2026", kind: "trip" });
    await render(<FoldersScreen />);
    const row = screen.getByRole("button", { name: /^Trip, Bali 2026, / });
    expect(row).toBeTruthy();
    const icon = screen.getByText("✈️", { includeHiddenElements: true });
    expect(icon.props.importantForAccessibility).toBe("no");
  });

  it("blank name cannot be saved", async () => {
    await render(<FoldersScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "New folder" }));
    await fireEvent.changeText(screen.getByLabelText("Folder name"), "   ");
    const create = screen.getByRole("button", { name: "Create" });
    expect(create.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(create);
    expect(listFolders(mockDb)).toHaveLength(0);
  });
});
