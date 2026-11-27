import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { createCategory, listCategories } from "@/db/repositories/categories";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";

import { CategoriesScreen } from "./CategoriesScreen";

let mockDb: AppDb;
const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () =>
  // Object.assign keeps the getters lazy (a spread would read them before the mocks exist).
  Object.assign(
    {
      get router() {
        return mockRouter;
      },
    },
    jest.requireActual("../../test/expoRouterStack").stackMock,
  ),
);

function seed(categoryId: string) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant: "Shop",
    purchasedAtLocal: "2026-05-10T10:00:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 4, 10),
    scannedAtUtc: Date.UTC(2026, 4, 10),
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: 1000,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 1000,
    parseSource: "manual",
    categoryId,
  });
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  jest.clearAllMocks();
});

describe("CategoriesScreen", () => {
  it("lists categories with receipt counts", async () => {
    seed("default:transport");
    seed("default:transport");
    seed("default:food_drink");
    await render(<CategoriesScreen />);
    expect(within(screen.getByTestId("category-row-default:transport")).getByText("2 receipts")).toBeTruthy();
    expect(within(screen.getByTestId("category-row-default:food_drink")).getByText("1 receipt")).toBeTruthy();
    expect(within(screen.getByTestId("category-row-default:other")).getByText("0 receipts")).toBeTruthy();
    expect(within(screen.getByTestId("category-row-default:transport")).getByText("Transport")).toBeTruthy();
  });

  it("adds a custom category with a color", async () => {
    await render(<CategoriesScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "New category…" }));
    await fireEvent.changeText(screen.getByLabelText("Category name"), "  Pets ");
    await fireEvent.press(screen.getByRole("radio", { name: "Green" }));
    await fireEvent.press(screen.getByRole("button", { name: "Add" }));
    const added = listCategories(mockDb).find((c) => c.customName === "Pets")!;
    expect(added.isDefault).toBe(false);
    expect(added.color).toBe("#2A9456");
    expect(await screen.findByText("Pets")).toBeTruthy();
  });

  it("blank name cannot be added", async () => {
    await render(<CategoriesScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "New category…" }));
    await fireEvent.changeText(screen.getByLabelText("Category name"), "  ");
    const add = screen.getByRole("button", { name: "Add" });
    expect(add.props.accessibilityState.disabled).toBe(true);
  });

  it("renames a default, then reset restores the translated label", async () => {
    await render(<CategoriesScreen />);
    const row = () => within(screen.getByTestId("category-row-default:food_drink"));
    expect(row().queryByRole("button", { name: "Reset name, Food & Drink" })).toBeNull();
    await fireEvent.press(row().getByRole("button", { name: "Rename, Food & Drink" }));
    await fireEvent.changeText(screen.getByLabelText("Category name"), "Eats");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Eats")).toBeTruthy();
    expect(screen.queryByText("Food & Drink")).toBeNull();
    await fireEvent.press(row().getByRole("button", { name: "Reset name, Eats" }));
    expect(await screen.findByText("Food & Drink")).toBeTruthy();
    expect(screen.queryByText("Eats")).toBeNull();
  });

  it("defaults have no delete action; custom rows have no reset", async () => {
    const c = createCategory(mockDb, { name: "Pets", color: "#123456" });
    await render(<CategoriesScreen />);
    expect(within(screen.getByTestId("category-row-default:other")).queryByRole("button", { name: /^Delete/ })).toBeNull();
    const row = within(screen.getByTestId(`category-row-${c.id}`));
    expect(row.getByRole("button", { name: "Delete, Pets" })).toBeTruthy();
    expect(row.queryByRole("button", { name: /^Reset name/ })).toBeNull();
  });

  it("delete confirms with the move message, then reassigns receipts", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const c = createCategory(mockDb, { name: "Pets", color: "#123456" });
    seed(c.id);
    seed(c.id);
    await render(<CategoriesScreen />);
    expect(within(screen.getByTestId(`category-row-${c.id}`)).getByText("2 receipts")).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId(`category-row-${c.id}`)).getByRole("button", { name: "Delete, Pets" }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][1]).toBe("2 receipts move to Other.");
    expect(listCategories(mockDb).some((x) => x.id === c.id)).toBe(true);
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    buttons.find((b) => b.style === "destructive")!.onPress!();
    expect(listCategories(mockDb).some((x) => x.id === c.id)).toBe(false);
    expect(await screen.findByText("2 receipts")).toBeTruthy();
    expect(screen.queryByText("Pets")).toBeNull();
    alert.mockRestore();
  });
});
