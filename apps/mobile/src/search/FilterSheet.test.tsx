import { fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

import { createFolder } from "@/db/repositories/folders";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";

import { FilterSheet } from "./FilterSheet";
import { EMPTY_SEARCH, type SearchState } from "./filterState";

let mockDb: AppDb;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({ usePref: () => "IDR" }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 30, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/ui/swift-ui", () => ({ DatePicker: () => null }));
jest.mock("@expo/ui", () => {
  const { View } = require("react-native");
  return { Host: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

function seed(currency: string) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant: "M",
    purchasedAtLocal: "2026-05-10T10:00:00",
    purchasedTz: "UTC",
    purchasedAtUtc: Date.UTC(2026, 4, 10),
    scannedAtUtc: Date.UTC(2026, 4, 10),
    scannedTz: "UTC",
    currency,
    totalMinor: 100,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 100,
    parseSource: "manual",
  });
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
});

const press = (name: string) => fireEvent.press(screen.getByRole(/button|radio|checkbox/, { name }));

describe("FilterSheet", () => {
  it("keeps its header below the status bar on android, with 16 dp of air", async () => {
    const original = Platform.OS;
    Platform.OS = "android";
    try {
      await render(<FilterSheet visible value={EMPTY_SEARCH} onApply={jest.fn()} onClose={jest.fn()} />);
      const flat = Object.assign({}, ...[screen.getByTestId("filter-sheet").props.style].flat());
      expect(flat.paddingTop).toBe(30 + 16);
    } finally {
      Platform.OS = original;
    }
  });

  it("Apply commits the chosen filters", async () => {
    seed("EUR");
    seed("IDR");
    createFolder(mockDb, { name: "Bali", kind: "trip" });
    const onApply = jest.fn();
    await render(<FilterSheet visible value={EMPTY_SEARCH} onApply={onApply} onClose={jest.fn()} />);
    await press("Food & Drink");
    await press("Transport");
    await press("No folder");
    await press("EUR");
    await press("Last month");
    await press("Apply");
    const got = onApply.mock.calls[0][0] as SearchState;
    expect(got.categoryIds).toHaveLength(2);
    expect(got.categoryIds).toEqual(expect.arrayContaining(["default:food_drink", "default:transport"]));
    expect(got).toMatchObject({ folderId: null, currency: "EUR", preset: "lastMonth", text: "" });
  });

  it("currency options come from receipts in use only", async () => {
    seed("EUR");
    await render(<FilterSheet visible value={EMPTY_SEARCH} onApply={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByRole("radio", { name: "EUR" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "JPY" })).toBeNull();
  });

  it("Cancel discards edits and keeps the text query on apply", async () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    await render(
      <FilterSheet visible value={{ ...EMPTY_SEARCH, text: "abc" }} onApply={onApply} onClose={onClose} />,
    );
    await press("Last month");
    await press("Cancel");
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    await press("Apply");
    expect(onApply.mock.calls[0][0]).toMatchObject({ text: "abc", preset: "lastMonth" });
  });
});
