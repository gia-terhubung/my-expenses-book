import { fireEvent, render, screen } from "@testing-library/react-native";

import { createPage } from "@/db/repositories/pages";
import { createReceipt, getReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import type { WindowClass } from "@/layout/windowClass";
import { createPrefs, type PrefsStore } from "@/prefs/prefs";

import { ReceiptFormScreen } from "./ReceiptFormScreen";

let mockDb: AppDb;
let mockPrefs: PrefsStore;
let mockClass: WindowClass = "compact";
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
jest.mock("@/layout/useWindowClass", () => ({ useWindowClass: () => mockClass }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
  usePreventRemove: () => () => undefined,
}));

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
  mockClass = "compact";
  mockMounts.fields = 0;
  mockMounts.pages = 0;
  jest.clearAllMocks();
});

describe("ReceiptFormScreen", () => {
  it("edit: typed values, fields and page viewer survive compact -> expanded -> compact", async () => {
    const r = seed("confirmed");
    mockParams = { id: r.id };
    const view = await render(<ReceiptFormScreen mode="edit" />);
    await fireEvent.changeText(screen.getByLabelText("Merchant"), "Warung Sari");
    const mounts = { ...mockMounts };
    expect(mounts.fields).toBe(1);

    mockClass = "expanded";
    await view.rerender(<ReceiptFormScreen mode="edit" />);
    expect(screen.getByLabelText("Merchant").props.value).toBe("Warung Sari");
    expect(screen.getAllByRole("imagebutton")).toHaveLength(1);

    mockClass = "compact";
    await view.rerender(<ReceiptFormScreen mode="edit" />);
    expect(screen.getByLabelText("Merchant").props.value).toBe("Warung Sari");
    expect(screen.getAllByRole("imagebutton")).toHaveLength(1);
    expect(mockMounts).toEqual(mounts);
    // Edit mode writes nothing before Save.
    expect(getReceipt(mockDb, r.id)?.merchant).toBe("Toko Maju");
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
});
