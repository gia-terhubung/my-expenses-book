import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { createFolder, listFolders } from "@/db/repositories/folders";
import { listReceipts } from "@/db/repositories/receiptQueries";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import { LAYOUTS } from "@/layout/testing/layouts";

import { CollectionScreen } from "./CollectionScreen";
import { useAndroidPlatform } from "../../test/androidPlatform";

let mockDb: AppDb;
const mockRouter = { push: jest.fn(), back: jest.fn(), setParams: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => ({}) }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => (k === "taxYearStartMonth" ? 4 : "IDR"),
}));
const mockLayout = LAYOUTS.phone;
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
      useLocalSearchParams: () => ({}),
      useFocusEffect: () => undefined,
    },
    jest.requireActual("../../test/expoRouterStack").stackMock,
  ),
);

function seed(
  merchant: string,
  local: string,
  totalMinor = 50000,
  folderId: string | null = null,
) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant,
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

// The in-page header and footer are Android's; iOS uses the native header (ScreenHeader.test).
useAndroidPlatform();

describe("CollectionScreen", () => {
  it("folder view shows only that folder's receipts with a total", async () => {
    const f = createFolder(mockDb, { name: "Bali", kind: "trip" });
    seed("InFolder", "2026-05-10T10:00:00", 70000, f.id);
    seed("Elsewhere", "2026-05-11T10:00:00", 10000);
    await render(<CollectionScreen kind="folder" folderId={f.id} />);
    expect(screen.getByText("Bali")).toBeTruthy();
    expect(screen.getByText("InFolder")).toBeTruthy();
    expect(screen.queryByText("Elsewhere")).toBeNull();
    expect(screen.getByTestId("collection-total").props.children).toMatch(
      /700/,
    );
  });

  it("rename updates the title", async () => {
    const f = createFolder(mockDb, { name: "Bali", kind: "trip" });
    await render(<CollectionScreen kind="folder" folderId={f.id} />);
    await fireEvent.press(screen.getByRole("button", { name: "Rename" }));
    await fireEvent.changeText(screen.getByLabelText("Folder name"), "Lombok");
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Lombok")).toBeTruthy();
    expect(screen.queryByText("Bali")).toBeNull();
    expect(listFolders(mockDb)[0].name).toBe("Lombok");
  });

  it("delete confirms, detaches receipts and navigates back", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const f = createFolder(mockDb, { name: "Bali", kind: "trip" });
    const r = seed("InFolder", "2026-05-10T10:00:00", 70000, f.id);
    await render(<CollectionScreen kind="folder" folderId={f.id} />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(listFolders(mockDb)).toHaveLength(1);
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    buttons.find((b) => b.style === "destructive")!.onPress!();
    expect(listFolders(mockDb)).toHaveLength(0);
    const row = listReceipts(mockDb, {}, { limit: 50 }).find(
      (x) => x.id === r.id,
    );
    expect(row?.folderId).toBeNull();
    expect(mockRouter.back).toHaveBeenCalled();
    alert.mockRestore();
  });

  it("tax-year view lists exactly the receipts in the range", async () => {
    seed("Before", "2026-03-31T23:00:00");
    seed("First", "2026-04-01T00:30:00");
    seed("Last", "2027-03-31T23:59:00");
    seed("After", "2027-04-01T00:00:00");
    await render(<CollectionScreen kind="taxYear" year={2026} />);
    expect(screen.getByText("Tax year 2026/27")).toBeTruthy();
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Last")).toBeTruthy();
    expect(screen.queryByText("Before")).toBeNull();
    expect(screen.queryByText("After")).toBeNull();
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
  });

  it("folder Export action opens /export with the folder id", async () => {
    const f = createFolder(mockDb, { name: "Bali", kind: "trip" });
    await render(<CollectionScreen kind="folder" folderId={f.id} />);
    await fireEvent.press(screen.getByRole("button", { name: "Export" }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/export", params: { folderId: f.id } });
  });

  it("tax-year Export action opens /export with the tax year range", async () => {
    await render(<CollectionScreen kind="taxYear" year={2026} />);
    await fireEvent.press(screen.getByRole("button", { name: "Export" }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/export",
      params: { from: "2026-04-01", to: "2027-03-31" },
    });
  });
});

describe("CollectionScreen not found", () => {
  it("a missing folder shows not-found; Back with no history goes to /folders", async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await render(<CollectionScreen kind="folder" folderId="does-not-exist" />);
    expect(screen.getByText("This folder no longer exists.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/folders");
  });

  it("a missing folder with history goes back", async () => {
    mockRouter.back.mockClear();
    await render(<CollectionScreen kind="folder" folderId="does-not-exist" />);
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("a NaN tax year shows not-found", async () => {
    await render(<CollectionScreen kind="taxYear" year={Number("abc")} />);
    expect(screen.getByText("This tax year can't be shown.")).toBeTruthy();
  });
});
