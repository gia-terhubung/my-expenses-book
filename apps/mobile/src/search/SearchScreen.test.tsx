import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { createCategory, softDeleteCategory } from "@/db/repositories/categories";
import { createFolder } from "@/db/repositories/folders";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n, setLanguage } from "@/i18n";

import { SearchScreen } from "./SearchScreen";

let mockDb: AppDb;
let mockParams: Record<string, string> = {};
const mockRouter = { push: jest.fn(), back: jest.fn(), setParams: jest.fn() };
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => ({}) }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => (k === "taxYearStartMonth" ? 1 : "IDR"),
}));
jest.mock("@/layout/useWindowClass", () => ({ useWindowClass: () => "compact" }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => undefined,
}));
jest.mock("@expo/ui/swift-ui", () => ({ DatePicker: () => null }));
jest.mock("@expo/ui", () => {
  const { View } = require("react-native");
  return { Host: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

function seed(merchant: string, categoryId: string | null) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant,
    purchasedAtLocal: "2026-05-10T10:00:00",
    purchasedTz: "UTC",
    purchasedAtUtc: Date.UTC(2026, 4, 10),
    scannedAtUtc: Date.UTC(2026, 4, 10),
    scannedTz: "UTC",
    currency: "IDR",
    totalMinor: 50000,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 50000,
    parseSource: "manual",
    categoryId,
  });
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  jest.clearAllMocks();
  mockParams = {};
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

const type = async (text: string) => {
  await fireEvent.changeText(screen.getByLabelText("Search receipts"), text);
};
const advance = (ms: number) => act(async () => void jest.advanceTimersByTime(ms));

describe("SearchScreen", () => {
  it("shows a hint, not the book, with no text and no filters", async () => {
    seed("Indomaret", null);
    await render(<SearchScreen />);
    expect(screen.getByText(/Search your receipts/)).toBeTruthy();
    expect(screen.queryByText("Indomaret")).toBeNull();
  });

  it("debounces text by 250 ms then shows the match and a count header", async () => {
    seed("Indomaret", null);
    seed("Alfamart", null);
    await render(<SearchScreen />);
    await type("indom");
    await advance(249);
    expect(screen.queryByText("Indomaret")).toBeNull();
    await advance(1);
    expect(screen.getByText("Indomaret")).toBeTruthy();
    expect(screen.queryByText("Alfamart")).toBeNull();
    expect(screen.getByTestId("search-total").props.children).toMatch(/1 receipt · .*500/);
  });

  it("text plus a category chip shows the intersection; removing the chip widens", async () => {
    seed("Indomaret", "default:groceries");
    seed("Indomaret Fresh", "default:transport");
    await render(<SearchScreen />);
    await type("indomaret");
    await advance(250);
    expect(screen.getByText("Indomaret Fresh")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Groceries" }));
    await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
    expect(screen.queryByText("Indomaret Fresh")).toBeNull();
    expect(screen.getByText("Indomaret")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Remove filter Groceries" }));
    expect(screen.getByText("Indomaret Fresh")).toBeTruthy();
  });

  it("filters alone (no text) list receipts; Clear all returns to the hint", async () => {
    seed("Indomaret", "default:groceries");
    const f = createFolder(mockDb, { name: "Bali", kind: "trip" });
    await render(<SearchScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("radio", { name: "No folder" }));
    await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByText("Indomaret")).toBeTruthy();
    expect(f.id).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.queryByText("Indomaret")).toBeNull();
    expect(screen.getByText(/Search your receipts/)).toBeTruthy();
  });

  it("param unconverted=1 shows the Belum dikonversi chip and only unconverted receipts", async () => {
    await act(async () => void setLanguage("id"));
    try {
      seed("Indomaret", null);
      createReceipt(mockDb, {
        status: "confirmed",
        merchant: "Warung Asing",
        purchasedAtLocal: "2026-05-11T10:00:00",
        purchasedTz: "UTC",
        purchasedAtUtc: Date.UTC(2026, 4, 11),
        scannedAtUtc: Date.UTC(2026, 4, 11),
        scannedTz: "UTC",
        currency: "USD",
        totalMinor: 1000,
        taxMinor: null,
        homeCurrencyAtSave: null,
        amountHomeMinor: null,
        parseSource: "manual",
      });
      mockParams = { unconverted: "1" };
      await render(<SearchScreen />);
      expect(screen.getByRole("button", { name: "Hapus filter Belum dikonversi" })).toBeTruthy();
      expect(screen.getByText("Warung Asing")).toBeTruthy();
      expect(screen.queryByText("Indomaret")).toBeNull();
    } finally {
      await act(async () => void setLanguage("en"));
    }
  });

  it("ignores a filtered category once it is deleted: no hidden filter, no chip", async () => {
    const snacks = createCategory(mockDb, { name: "Snacks", color: "#FF8800" });
    seed("Toko Satu", snacks.id);
    seed("Toko Dua", "default:groceries");
    await render(<SearchScreen />);
    await type("toko");
    await advance(250);
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByRole("checkbox", { name: "Snacks" }));
    await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
    expect(screen.queryByText("Toko Dua")).toBeNull();
    expect(screen.getByRole("button", { name: "Filters (1)" })).toBeTruthy();

    await act(async () => void softDeleteCategory(mockDb, snacks.id));
    expect(screen.getByText("Toko Satu")).toBeTruthy();
    expect(screen.getByText("Toko Dua")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove filter Snacks" })).toBeNull();
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
  });

  it("shows the empty state for a query with no matches", async () => {
    seed("Indomaret", null);
    await render(<SearchScreen />);
    await type("zzzz");
    await advance(250);
    expect(screen.getByText("No receipts match your search.")).toBeTruthy();
  });
});
