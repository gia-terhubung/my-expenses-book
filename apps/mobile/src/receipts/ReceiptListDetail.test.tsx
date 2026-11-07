import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Alert, BackHandler, Text, type AlertButton } from "react-native";

import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import type { WindowClass } from "@/layout/windowClass";

import { ReceiptListDetail } from "./ReceiptListDetail";

let mockDb: AppDb;
let mockClass: WindowClass = "compact";
let mockParams: { selected?: string } = {};
const mockRouter = { push: jest.fn(), setParams: jest.fn(), back: jest.fn() };
const mockImages = {
  openForView: jest.fn(async (p: string) => `file:///cache/view/${p}`),
  deleteFiles: jest.fn(async (_: string[]) => {}),
  closeViews: jest.fn(async (_: string[]) => {}),
};
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => mockImages }));
jest.mock("@/prefs/PrefsProvider", () => ({ usePref: () => "IDR" }));
jest.mock("@/layout/useWindowClass", () => ({ useWindowClass: () => mockClass }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
}));

// Mount counters around the real list and detail: a remount would reset scroll offset, loaded
// window and in-progress detail state.
const mockMounts = { list: 0, detail: 0 };
jest.mock("./ReceiptList", () => {
  const { useEffect } = jest.requireActual("react");
  const actual = jest.requireActual("./ReceiptList");
  return {
    ReceiptList: (props: object) => {
      useEffect(() => {
        mockMounts.list += 1;
      }, []);
      return actual.ReceiptList(props);
    },
  };
});
jest.mock("./ReceiptDetail", () => {
  const { useEffect } = jest.requireActual("react");
  const actual = jest.requireActual("./ReceiptDetail");
  return {
    ReceiptDetail: (props: object) => {
      useEffect(() => {
        mockMounts.detail += 1;
      }, []);
      return actual.ReceiptDetail(props);
    },
  };
});

function seed(merchant: string, local: string) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant,
    purchasedAtLocal: local,
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 10, 1),
    scannedAtUtc: Date.UTC(2026, 10, 1),
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: 50000,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 50000,
    parseSource: "manual",
  });
}

const filter = {};
const ui = () => <ReceiptListDetail filter={filter} empty={<Text>nothing</Text>} />;

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  mockParams = {};
  mockClass = "compact";
  mockMounts.list = 0;
  mockMounts.detail = 0;
  jest.clearAllMocks();
});

describe("ReceiptListDetail", () => {
  it("compact: row press pushes the document route", async () => {
    const a = seed("Alpha", "2026-11-03T10:00:00");
    await render(ui());
    await fireEvent.press(screen.getByText("Alpha"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/document/[id]", params: { id: a.id } });
    expect(mockRouter.setParams).not.toHaveBeenCalled();
  });

  it("expanded: row press sets `selected` and the detail renders in the secondary pane", async () => {
    mockClass = "expanded";
    const a = seed("Alpha", "2026-11-03T10:00:00");
    const view = await render(ui());
    expect(screen.getByTestId("pane-placeholder")).toBeTruthy();
    await fireEvent.press(within(screen.getByTestId("pane-primary")).getByText("Alpha"));
    expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: a.id });
    expect(mockRouter.push).not.toHaveBeenCalled();

    mockParams = { selected: a.id };
    await view.rerender(ui());
    const secondary = screen.getByTestId("pane-secondary");
    expect(within(secondary).getByText("Alpha")).toBeTruthy();
    expect(within(secondary).getByRole("button", { name: "Delete" })).toBeTruthy();
    // No back control beside the list.
    expect(within(secondary).queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("fold continuity: expanded -> compact keeps the detail with a back control; compact -> expanded keeps the row selected", async () => {
    mockClass = "expanded";
    const a = seed("Alpha", "2026-11-03T10:00:00");
    seed("Beta", "2026-11-02T10:00:00");
    mockParams = { selected: a.id };
    const view = await render(ui());

    mockClass = "compact";
    await view.rerender(ui());
    expect(screen.queryByTestId("pane-primary")).toBeNull();
    const secondary = screen.getByTestId("pane-secondary");
    expect(within(secondary).getByText("Alpha")).toBeTruthy();
    await fireEvent.press(within(secondary).getByRole("button", { name: "Back" }));
    expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: undefined });

    mockClass = "expanded";
    await view.rerender(ui());
    expect(screen.getByTestId(`receipt-row-${a.id}`).props.accessibilityState.selected).toBe(true);
    expect(within(screen.getByTestId("pane-secondary")).getByText("Alpha")).toBeTruthy();
  });

  it("compact with `selected`: Android back clears the param", async () => {
    const a = seed("Alpha", "2026-11-03T10:00:00");
    let handler: (() => boolean | null | undefined) | undefined;
    const remove = jest.fn();
    const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_e, h) => {
      handler = h as unknown as () => boolean;
      return { remove };
    });
    mockParams = { selected: a.id };
    const view = await render(ui());
    expect(handler?.()).toBe(true);
    expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: undefined });

    // Expanded: back is not intercepted.
    handler = undefined;
    mockClass = "expanded";
    await view.rerender(ui());
    expect(remove).toHaveBeenCalled();
    expect(handler).toBeUndefined();
    spy.mockRestore();
  });

  it("Edit pushes the edit route", async () => {
    mockClass = "expanded";
    const a = seed("Alpha", "2026-11-03T10:00:00");
    mockParams = { selected: a.id };
    await render(ui());
    await fireEvent.press(screen.getByRole("button", { name: "Edit" }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/edit/[id]", params: { id: a.id } });
  });

  it("deleting from the pane clears `selected`", async () => {
    mockClass = "expanded";
    const a = seed("Alpha", "2026-11-03T10:00:00");
    mockParams = { selected: a.id };
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons?: AlertButton[]) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });
    await render(ui());
    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: undefined }));
    alert.mockRestore();
  });

  it("fold/unfold keeps the same list and detail instances (no remount)", async () => {
    mockClass = "expanded";
    const a = seed("Alpha", "2026-11-03T10:00:00");
    mockParams = { selected: a.id };
    const view = await render(ui());
    mockClass = "compact";
    await view.rerender(ui());
    mockClass = "expanded";
    await view.rerender(ui());
    mockClass = "compact";
    await view.rerender(ui());
    // Back from the folded detail shows the list again.
    mockParams = {};
    await view.rerender(ui());
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(mockMounts).toEqual({ list: 1, detail: 1 });
  });
});
