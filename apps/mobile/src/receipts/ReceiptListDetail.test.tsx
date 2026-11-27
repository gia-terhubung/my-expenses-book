import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { Alert, BackHandler, Text, type AlertButton } from "react-native";

import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import { LAYOUTS } from "@/layout/testing/layouts";
import type { Layout } from "@/layout/layout";

import { setPendingSelection, takePendingSelection } from "./pendingSelection";
import { ReceiptListDetail } from "./ReceiptListDetail";
import { useAndroidPlatform } from "../../test/androidPlatform";

let mockDb: AppDb;
let mockLayout: Layout = LAYOUTS.phone;
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
jest.mock("@/layout/useLayout", () => ({ useLayout: () => mockLayout }));
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
      useLocalSearchParams: () => mockParams,
      // Runs the callback like a focused screen does, unless the test marks the screen unfocused.
      useFocusEffect: (cb: () => void | (() => void)) => {
        const { useEffect } = jest.requireActual("react");
        useEffect(() => (mockFocused ? cb() : undefined), [cb]);
      },
    },
    jest.requireActual("../../test/expoRouterStack").stackMock,
  ),
);
let mockFocused = true;

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
  mockLayout = LAYOUTS.phone;
  mockFocused = true;
  takePendingSelection();
  mockMounts.list = 0;
  mockMounts.detail = 0;
  jest.clearAllMocks();
});

// The in-page header and footer are Android's; iOS uses the native header (ScreenHeader.test).
useAndroidPlatform();

describe("ReceiptListDetail", () => {
  it("not split: row press pushes the document route", async () => {
    const a = seed("Alpha", "2026-11-03T10:00:00");
    await render(ui());
    await fireEvent.press(screen.getByText("Alpha"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/document/[id]", params: { id: a.id, from: "list" } });
    expect(mockRouter.setParams).not.toHaveBeenCalled();
  });

  it.each([["phone"], ["duoPortrait"]] as const)("not split (%s): row press pushes the document route", async (name) => {
    mockLayout = LAYOUTS[name];
    const a = seed("Alpha", "2026-11-03T10:00:00");
    await render(ui());
    await fireEvent.press(screen.getByText("Alpha"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/document/[id]", params: { id: a.id, from: "list" } });
    expect(mockRouter.setParams).not.toHaveBeenCalled();
  });

  it("split -> open portrait with a selection: detail with a back control; Android back clears", async () => {
    mockLayout = LAYOUTS.duoLandscape;
    const a = seed("Alpha", "2026-11-03T10:00:00");
    mockParams = { selected: a.id };
    let handler: (() => boolean | null | undefined) | undefined;
    const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_e, h) => {
      handler = h as unknown as () => boolean;
      return { remove: jest.fn() };
    });
    const view = await render(ui());
    mockLayout = LAYOUTS.duoPortrait;
    await view.rerender(ui());
    expect(within(screen.getByTestId("pane-secondary")).getByRole("button", { name: "Back" })).toBeTruthy();
    expect(handler?.()).toBe(true);
    expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: undefined });
    spy.mockRestore();
  });

  it("a pending selection from a popped document becomes `selected` on focus, once", async () => {
    mockLayout = LAYOUTS.duoLandscape;
    const a = seed("Alpha", "2026-11-03T10:00:00");
    setPendingSelection(a.id);
    await render(ui());
    expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: a.id });
    expect(takePendingSelection()).toBeNull();
  });

  it("unfocused screens leave the pending selection alone", async () => {
    mockLayout = LAYOUTS.duoLandscape;
    const a = seed("Alpha", "2026-11-03T10:00:00");
    setPendingSelection(a.id);
    mockFocused = false;
    await render(ui());
    expect(mockRouter.setParams).not.toHaveBeenCalled();
    expect(takePendingSelection()).toBe(a.id);
  });

  it("split: row press sets `selected` and the detail renders in the secondary pane", async () => {
    mockLayout = LAYOUTS.duoLandscape;
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

  it("fold continuity: split -> not split keeps the detail with a back control; not split -> split keeps the row selected", async () => {
    mockLayout = LAYOUTS.duoLandscape;
    const a = seed("Alpha", "2026-11-03T10:00:00");
    seed("Beta", "2026-11-02T10:00:00");
    mockParams = { selected: a.id };
    const view = await render(ui());

    mockLayout = LAYOUTS.phone;
    await view.rerender(ui());
    expect(screen.queryByTestId("pane-primary")).toBeNull();
    const secondary = screen.getByTestId("pane-secondary");
    expect(within(secondary).getByText("Alpha")).toBeTruthy();
    await fireEvent.press(within(secondary).getByRole("button", { name: "Back" }));
    expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: undefined });

    mockLayout = LAYOUTS.duoLandscape;
    await view.rerender(ui());
    expect(screen.getByTestId(`receipt-row-${a.id}`).props.accessibilityState.selected).toBe(true);
    expect(within(screen.getByTestId("pane-secondary")).getByText("Alpha")).toBeTruthy();
  });

  it("not split with `selected`: Android back clears the param", async () => {
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

    // Split: back is not intercepted.
    handler = undefined;
    mockLayout = LAYOUTS.duoLandscape;
    await view.rerender(ui());
    expect(remove).toHaveBeenCalled();
    expect(handler).toBeUndefined();
    spy.mockRestore();
  });

  it("not split with `selected` but unfocused: Android back is not intercepted", async () => {
    const a = seed("Alpha", "2026-11-03T10:00:00");
    const spy = jest.spyOn(BackHandler, "addEventListener");
    mockFocused = false;
    mockParams = { selected: a.id };
    await render(ui());
    expect(spy).not.toHaveBeenCalledWith("hardwareBackPress", expect.anything());
    spy.mockRestore();
  });

  it("Edit pushes the edit route", async () => {
    mockLayout = LAYOUTS.duoLandscape;
    const a = seed("Alpha", "2026-11-03T10:00:00");
    mockParams = { selected: a.id };
    await render(ui());
    await fireEvent.press(screen.getByRole("button", { name: "Edit" }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/edit/[id]", params: { id: a.id } });
  });

  it("deleting from the pane clears `selected`", async () => {
    mockLayout = LAYOUTS.duoLandscape;
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
    mockLayout = LAYOUTS.duoLandscape;
    const a = seed("Alpha", "2026-11-03T10:00:00");
    mockParams = { selected: a.id };
    const view = await render(ui());
    mockLayout = LAYOUTS.phone;
    await view.rerender(ui());
    mockLayout = LAYOUTS.duoLandscape;
    await view.rerender(ui());
    mockLayout = LAYOUTS.phone;
    await view.rerender(ui());
    // Back from the folded detail shows the list again.
    mockParams = {};
    await view.rerender(ui());
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(mockMounts).toEqual({ list: 1, detail: 1 });
  });
});
