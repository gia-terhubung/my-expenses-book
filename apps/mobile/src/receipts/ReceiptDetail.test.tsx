import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, StyleSheet, type AlertButton } from "react-native";

import { listCategories } from "@/db/repositories/categories";
import { createFolder } from "@/db/repositories/folders";
import { createPage } from "@/db/repositories/pages";
import { createReceipt, getReceipt, softDeleteReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb, NewReceiptInput } from "@/db/types";
import { i18n, initI18n } from "@/i18n";
import { formatMoney } from "@/money/money";
import { categoryLabel } from "@/review/ReviewFields";

import { ReceiptDetail } from "./ReceiptDetail";

let mockDb: AppDb;
const mockImages = {
  openForView: jest.fn(async (p: string) => `file:///cache/view/${p}`),
  deleteFiles: jest.fn(async (_: string[]) => {}),
  closeViews: jest.fn(async (_: string[]) => {}),
};
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => mockImages }));
jest.mock("@/prefs/PrefsProvider", () => ({ usePref: () => "IDR" }));
let mockBottom = 0;
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: mockBottom, left: 0, right: 0 }),
}));
const mockRouter = { push: jest.fn() };
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

function seed(over: Partial<NewReceiptInput> = {}) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant: "Blue Bottle",
    purchasedAtLocal: "2026-11-03T10:15:00",
    purchasedTz: "America/New_York",
    purchasedAtUtc: Date.UTC(2026, 10, 3, 15, 15),
    scannedAtUtc: Date.UTC(2026, 10, 3, 16, 0),
    scannedTz: "America/New_York",
    currency: "USD",
    totalMinor: 1234,
    taxMinor: null,
    fxRate: "16250",
    fxRateDate: "2026-11-02",
    fxApproximate: true,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 200525,
    parseSource: "manual",
    ...over,
  });
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  jest.clearAllMocks();
});

const noop = () => {};

describe("ReceiptDetail", () => {
  it("content is a centred column at most 640 wide (deep-linked on a wide screen)", async () => {
    const r = seed();
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    const style = StyleSheet.flatten(screen.getByTestId("receipt-detail-scroll").props.contentContainerStyle);
    expect(style).toMatchObject({ width: "100%", maxWidth: 640, alignSelf: "center" });
  });

  it("action row wraps in a narrow detail pane (320)", async () => {
    const r = seed();
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    const style = StyleSheet.flatten(screen.getByTestId("receipt-detail-actions").props.style);
    expect(style).toMatchObject({ flexDirection: "row", flexWrap: "wrap", gap: 8 });
  });

  it("shows merchant, local date/time, totals, FX line, category, folder and notes", async () => {
    const cat = listCategories(mockDb)[0];
    const folder = createFolder(mockDb, { name: "Bali 2026", kind: "trip" });
    const r = seed({ categoryId: cat.id, folderId: folder.id, notes: "Team coffee" });
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);

    expect(screen.getByText("Blue Bottle")).toBeTruthy();
    expect(screen.getByText(/Nov 3, 2026.*10:15/)).toBeTruthy();
    expect(screen.getByText(formatMoney(1234, "USD", "en"))).toBeTruthy();
    expect(screen.getByText(`≈ ${formatMoney(200525, "IDR", "en")}`)).toBeTruthy();
    const fx = screen.getByTestId("fx-line").props.children as string;
    expect(fx).toContain("1 USD = 16,250 IDR");
    expect(fx).toContain("Nov 2, 2026");
    expect(fx).toContain("approximate");
    expect(screen.getByText(categoryLabel(cat, i18n.t))).toBeTruthy();
    expect(screen.getByText("Bali 2026")).toBeTruthy();
    expect(screen.getByText("Team coffee")).toBeTruthy();
  });

  it("FX line: small rates read the other way round, no approximate marker when exact", async () => {
    // IDR receipt, USD home: stored rate 0.0000615 USD per 1 IDR reads as 1 USD = 16,260.2 IDR.
    const r = seed({
      currency: "IDR",
      totalMinor: 200000,
      homeCurrencyAtSave: "USD",
      amountHomeMinor: 1230,
      fxRate: "0.0000615",
      fxApproximate: false,
      fxRateDate: "2026-11-03",
    });
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    const fx = screen.getByTestId("fx-line").props.children as string;
    expect(fx).toContain("1 USD = 16,260.2 IDR");
    expect(fx).not.toContain("approximate");
  });

  it("FX line: a rate near 1 reads receipt to home; a manual rate says so", async () => {
    const r = seed({ currency: "EUR", fxRate: "0.92", fxRateDate: null, fxApproximate: false, homeCurrencyAtSave: "USD" });
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    const fx = screen.getByTestId("fx-line").props.children as string;
    expect(fx).toContain("1 EUR = 0.92 USD");
    expect(fx).toContain("manual rate");
  });

  it("no FX line for a receipt in the home currency", async () => {
    const r = seed({ currency: "IDR", homeCurrencyAtSave: "IDR", fxRate: "1", fxApproximate: false });
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    expect(screen.queryByTestId("fx-line")).toBeNull();
  });

  it("Edit calls onEdit with the id", async () => {
    const r = seed();
    const onEdit = jest.fn();
    await render(<ReceiptDetail id={r.id} onEdit={onEdit} onDeleted={noop} />);
    await fireEvent.press(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(r.id);
  });

  it("Move to folder updates folderId", async () => {
    const folder = createFolder(mockDb, { name: "Office", kind: "project" });
    const r = seed();
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    await fireEvent.press(screen.getByRole("button", { name: "Move to folder" }));
    await fireEvent.press(await screen.findByRole("radio", { name: "Office" }));
    expect(getReceipt(mockDb, r.id)?.folderId).toBe(folder.id);
    expect(await screen.findByText("Office")).toBeTruthy();
  });

  it("Delete confirms, discards the receipt and its files, then calls onDeleted", async () => {
    const r = seed();
    createPage(mockDb, { receiptId: r.id, pageIndex: 0, imagePath: "img/a.enc", thumbPath: "img/a.thumb.enc", width: 3, height: 4, dhash: null });
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons?: AlertButton[]) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });
    const onDeleted = jest.fn();
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={onDeleted} />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    expect(alert).toHaveBeenCalled();
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(getReceipt(mockDb, r.id)).toBeNull();
    expect(mockImages.deleteFiles).toHaveBeenCalledWith(expect.arrayContaining(["img/a.enc", "img/a.thumb.enc"]));
    alert.mockRestore();
  });

  it("cancelling the confirmation keeps the receipt", async () => {
    const r = seed();
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const onDeleted = jest.fn();
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={onDeleted} />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    expect(getReceipt(mockDb, r.id)).not.toBeNull();
    expect(onDeleted).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it("a soft-deleted id renders the missing state", async () => {
    const r = seed();
    softDeleteReceipt(mockDb, r.id);
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    expect(screen.getByText("This receipt is no longer available.")).toBeTruthy();
    expect(screen.queryByText("Blue Bottle")).toBeNull();
  });

  it("back control only when onBack is given", async () => {
    const r = seed();
    const onBack = jest.fn();
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} onBack={onBack} />);
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("no back control without onBack (route header owns back)", async () => {
    const r = seed();
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("keeps the last action above the home indicator / system bar when pushed (no tab bar)", async () => {
    const r = seed();
    mockBottom = 34;
    try {
      await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} onBack={noop} />);
      const style = screen.getByTestId("receipt-detail-scroll").props.contentContainerStyle;
      expect(style.paddingBottom).toBe(34 + 24);
    } finally {
      mockBottom = 0;
    }
  });

  it("back chevron calls onBack and the merchant is the header", async () => {
    const r = seed();
    const onBack = jest.fn();
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} onBack={onBack} />);
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("receipt-detail-scroll").props.contentInsetAdjustmentBehavior).toBe("never");
  });

  it("'Repeat this…' opens the rule form prefilled from a confirmed receipt", async () => {
    const r = seed();
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    await fireEvent.press(screen.getByRole("button", { name: "Repeat this…" }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/recurring/[id]", params: { id: "new", from: r.id } });
  });

  it("no 'Repeat this…' for a draft, or for a receipt a rule already created", async () => {
    const draft = seed({ status: "draft" });
    const view = await render(<ReceiptDetail id={draft.id} onEdit={noop} onDeleted={noop} />);
    expect(screen.queryByRole("button", { name: "Repeat this…" })).toBeNull();
    const owned = seed({ recurringRuleId: "rule-1", recurringDate: "2026-11-03" });
    await view.rerender(<ReceiptDetail id={owned.id} onEdit={noop} onDeleted={noop} />);
    expect(screen.queryByRole("button", { name: "Repeat this…" })).toBeNull();
  });

  it("the receipt photo sits right under the actions, above category and folder", async () => {
    const r = seed();
    createPage(mockDb, { receiptId: r.id, pageIndex: 0, imagePath: "img/a.enc", thumbPath: null, width: 3, height: 4, dhash: null });
    await render(<ReceiptDetail id={r.id} onEdit={noop} onDeleted={noop} />);
    await screen.findByRole("imagebutton");
    const tree = JSON.stringify(screen.toJSON());
    const actions = tree.indexOf('"receipt-detail-actions"');
    const photo = tree.indexOf("Open photo full screen");
    const category = tree.indexOf('"Category"');
    expect(actions).toBeGreaterThan(-1);
    expect(photo).toBeGreaterThan(actions);
    expect(category).toBeGreaterThan(photo);
  });
});
