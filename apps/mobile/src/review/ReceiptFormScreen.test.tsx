import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo, Keyboard, Platform, StyleSheet } from "react-native";

import { createPage } from "@/db/repositories/pages";
import { createReceipt, getReceipt, updateReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import { LAYOUTS } from "@/layout/testing/layouts";
import type { Layout } from "@/layout/layout";
import { createPrefs, type PrefsStore } from "@/prefs/prefs";

import { ReceiptFormScreen } from "./ReceiptFormScreen";
import { runAsAndroid } from "../../test/androidPlatform";

let mockDb: AppDb;
let mockPrefs: PrefsStore;
let mockLayout: Layout = LAYOUTS.phone;
let mockParams: { id: string; queue?: string } = { id: "" };
const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
const mockImages = {
  openForView: jest.fn(async (p: string) => `file:///cache/view/${p}`),
  deleteFiles: jest.fn(async (_: string[]) => {}),
  closeViews: jest.fn(async (_: string[]) => {}),
};
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => mockImages }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePrefs: () => mockPrefs,
  usePref: (k: "homeCurrency") => mockPrefs.get(k),
}));
jest.mock("@/layout/useLayout", () => ({ useLayout: () => mockLayout }));
let mockTop = 0;
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: mockTop, bottom: 0, left: 0, right: 0 }),
  initialWindowMetrics: null,
}));
jest.mock("expo-router", () =>
  // Object.assign keeps the getters lazy (a spread would read them before the mocks exist).
  Object.assign(
    {
      get router() {
        return mockRouter;
      },
      useLocalSearchParams: () => mockParams,
      usePreventRemove: () => () => undefined,
    },
    jest.requireActual("../../test/expoRouterStack").stackMock,
  ),
);

// Mount counters around the real fields and page viewer: a remount on fold would drop focus,
// local picker state and the decrypted page views.
const mockMounts = { fields: 0, pages: 0 };
jest.mock("./ReviewFields", () => {
  const { useEffect } = jest.requireActual("react");
  const actual = jest.requireActual("./ReviewFields");
  return {
    ...actual,
    ReviewFields: (props: object) => {
      useEffect(() => {
        mockMounts.fields += 1;
      }, []);
      return actual.ReviewFields(props);
    },
  };
});
jest.mock("./PageViewer", () => {
  const { useEffect } = jest.requireActual("react");
  const actual = jest.requireActual("./PageViewer");
  return {
    PageViewer: (props: object) => {
      useEffect(() => {
        mockMounts.pages += 1;
      }, []);
      return actual.PageViewer(props);
    },
  };
});

function memoryPrefs(): PrefsStore {
  const m = new Map<string, string>();
  return createPrefs({ getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), delete: (k) => void m.delete(k) });
}

function seed(status: "draft" | "confirmed") {
  const r = createReceipt(mockDb, {
    status,
    merchant: "Toko Maju",
    purchasedAtLocal: "2026-11-03T10:15:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 10, 3, 3, 15),
    scannedAtUtc: Date.UTC(2026, 10, 5, 5, 0),
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: 2500000,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 2500000,
    parseSource: "manual",
  });
  createPage(mockDb, { receiptId: r.id, pageIndex: 0, imagePath: "pages/a.enc", thumbPath: null, width: 30, height: 40, dhash: null });
  return r;
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  mockPrefs = memoryPrefs();
  mockPrefs.set("homeCurrency", "IDR");
  mockLayout = LAYOUTS.phone;
  mockMounts.fields = 0;
  mockMounts.pages = 0;
  jest.clearAllMocks();
});

// The in-page header and footer are Android's; iOS uses the native header (ScreenHeader.test).
runAsAndroid();

describe("ReceiptFormScreen", () => {
  it("edit: typed values, fields and page viewer survive not split -> split -> not split", async () => {
    const r = seed("confirmed");
    mockParams = { id: r.id };
    const view = await render(<ReceiptFormScreen mode="edit" />);
    await fireEvent.changeText(screen.getByLabelText("Merchant"), "Warung Sari");
    const mounts = { ...mockMounts };
    expect(mounts.fields).toBe(1);

    mockLayout = LAYOUTS.duoLandscape;
    await view.rerender(<ReceiptFormScreen mode="edit" />);
    expect(screen.getByLabelText("Merchant").props.value).toBe("Warung Sari");
    expect(screen.getAllByRole("imagebutton")).toHaveLength(1);

    mockLayout = LAYOUTS.phone;
    await view.rerender(<ReceiptFormScreen mode="edit" />);
    expect(screen.getByLabelText("Merchant").props.value).toBe("Warung Sari");
    expect(screen.getAllByRole("imagebutton")).toHaveLength(1);
    expect(mockMounts).toEqual(mounts);
    // Edit mode writes nothing before Save.
    expect(getReceipt(mockDb, r.id)?.merchant).toBe("Toko Maju");
  });

  it("open portrait (icon rail, not split): one column with the inline viewer", async () => {
    mockLayout = LAYOUTS.duoPortrait;
    const r = seed("confirmed");
    mockParams = { id: r.id };
    await render(<ReceiptFormScreen mode="edit" />);
    expect(screen.getAllByRole("imagebutton")).toHaveLength(1);
    expect(screen.getByLabelText("Merchant")).toBeTruthy();
  });

  it("edit: Cancel and Save, no Discard / Review later; Save writes and goes back", async () => {
    const r = seed("confirmed");
    mockParams = { id: r.id };
    await render(<ReceiptFormScreen mode="edit" />);
    expect(screen.getByText("Edit receipt")).toBeTruthy();
    expect(screen.queryByText("Discard")).toBeNull();
    expect(screen.queryByText("Review later")).toBeNull();
    expect(screen.getByRole("button", { name: "Folder No folder" })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Merchant"), "Warung Sari");
    await fireEvent.press(screen.getByRole("button", { name: "Save receipt" }));
    expect(getReceipt(mockDb, r.id)).toMatchObject({ merchant: "Warung Sari", status: "confirmed" });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("a blocked save announces the first error and puts it in the field's hint", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
    const r = seed("confirmed");
    mockParams = { id: r.id };
    await render(<ReceiptFormScreen mode="edit" />);
    await fireEvent.changeText(screen.getByLabelText("Total"), "");
    await fireEvent.press(screen.getByRole("button", { name: "Save receipt" }));
    expect(announce).toHaveBeenCalledWith("Enter the total.");
    expect(screen.getByLabelText("Total").props.accessibilityHint).toContain("Enter the total.");
    announce.mockRestore();
  });

  it("edit: Cancel without changes goes back", async () => {
    const r = seed("confirmed");
    mockParams = { id: r.id };
    await render(<ReceiptFormScreen mode="edit" />);
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("review: keeps Discard and Review later", async () => {
    const r = seed("draft");
    mockParams = { id: r.id };
    await render(<ReceiptFormScreen mode="review" />);
    expect(screen.getByText("Review receipt")).toBeTruthy();
    expect(screen.getByText("Discard")).toBeTruthy();
    expect(screen.getByText("Review later")).toBeTruthy();
  });

  it("Android: the header clears the status bar (the modal is full screen under it); iOS: small gap under the native header", async () => {
    const original = Platform.OS;
    try {
      mockParams = { id: seed("confirmed").id };
      mockTop = 32;
      Platform.OS = "android";
      const view = await render(<ReceiptFormScreen mode="edit" />);
      expect(StyleSheet.flatten((await screen.findByTestId("form-header")).props.style).paddingTop).toBe(32 + 16);
      await view.unmount();
      Platform.OS = "ios";
      await render(<ReceiptFormScreen mode="edit" />);
      expect(StyleSheet.flatten((await screen.findByTestId("form-header")).props.style).paddingTop).toBe(8);
    } finally {
      Platform.OS = original;
      mockTop = 0;
    }
  });

  it("hides the Discard / Save bar while the keyboard is up, so it never covers a focused field", async () => {
    const listeners: Record<string, () => void> = {};
    jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: () => void) => {
      listeners[event] = cb;
      return { remove: jest.fn() };
    }) as never);
    try {
      const r = seed("draft");
      mockParams = { id: r.id };
      await render(<ReceiptFormScreen mode="review" />);
      expect(screen.getByTestId("form-footer")).toBeTruthy();
      const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
      const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
      await act(async () => listeners[show]());
      expect(screen.queryByTestId("form-footer")).toBeNull();
      expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
      await act(async () => listeners[hide]());
      expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("a draft created by a recurring rule is labelled Recurring in the header", async () => {
    const r = seed("draft");
    updateReceipt(mockDb, r.id, { recurringRuleId: "rule-1", recurringDate: "2026-11-03" });
    mockParams = { id: r.id };
    await render(<ReceiptFormScreen mode="review" />);
    expect(within(screen.getByTestId("form-header")).getByText("Recurring")).toBeTruthy();
  });

  it("no Recurring label on an ordinary draft", async () => {
    const r = seed("draft");
    mockParams = { id: r.id };
    await render(<ReceiptFormScreen mode="review" />);
    expect(screen.queryByTestId("review-recurring-label")).toBeNull();
  });
});
