import { render, screen, within } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AddReceiptContext, type AddReceipt } from "@/capture/addReceiptContext";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import { CollectionScreen } from "@/organize/CollectionScreen";
import { RecurringList } from "@/recurring/RecurringList";
import { createRule } from "@/recurring/rules";

import { NativeTabsContext } from "./navContext";

/**
 * iOS, iPhone Duo side column (spec "Final decisions", short column < 560 pt): pages without their
 * own ⋯ (Recurring with rules, Tax year) fold their buttons and the + into a ⋯ menu, "Add receipt"
 * first, so nothing is lost when the column is too short. A tall column keeps the buttons and the +.
 */
let mockDb: AppDb;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => ({}) }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => (k === "taxYearStartMonth" ? 4 : k === "fxTables" ? undefined : "IDR"),
}));
jest.mock("@/layout/useLayout", () => ({ useLayout: () => jest.requireActual("@/layout/testing/layouts").LAYOUTS.phone }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 84 }),
}));
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock,
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));
jest.mock("expo-status-bar", () => ({ useVerticalBarEdgeIOS: () => "trailing" }));
let mockHeight = 466;
let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 874, height: mockHeight, scale: 3, fontScale: mockFontScale }),
}));
jest.mock("@/recurring/deviceScheduler", () => ({ deviceScheduler: {} }));

const add: AddReceipt = { open: jest.fn(), start: jest.fn(async () => {}) };
function InTabs({ children }: { children: ReactNode }) {
  return (
    <NativeTabsContext.Provider value>
      <AddReceiptContext.Provider value={add}>{children}</AddReceiptContext.Provider>
    </NativeTabsContext.Provider>
  );
}

/** Accessible names inside the ⋯ menu, in order: its rows, and the "Add receipt" submenu with its rows. */
const moreItems = () =>
  within(screen.getByLabelText("More"))
    .queryAllByLabelText(/.+/)
    .map((n) => n.props.accessibilityLabel as string)
    .filter((l, i, all) => all.indexOf(l) === i);

const ADD_RECEIPT = ["Add receipt", "Scan receipt", "Import from Photos", "Add manually"];

function seedRule() {
  createRule(
    mockDb,
    {
      merchant: "Netflix",
      currency: "IDR",
      totalMinor: 18600000,
      taxMinor: null,
      categoryId: null,
      folderId: null,
      notes: null,
      frequency: "monthly",
      anchorDate: "2026-11-01",
      monthDay: 1,
      tz: "Europe/Paris",
      autoAdd: true,
      endDate: null,
    },
    new Date("2026-11-20T05:00:00Z"),
  );
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  mockHeight = 466;
  mockFontScale = 1;
});

describe("short column (iOS, Duo held sideways)", () => {
  it("Recurring with rules folds New into ⋯ with Add receipt first", async () => {
    seedRule();
    await render(
      <InTabs>
        <RecurringList selectedId={null} onBack={() => {}} onNew={() => {}} onSelect={() => {}} />
      </InTabs>,
    );
    expect(moreItems()).toEqual([...ADD_RECEIPT, "New"]);
    expect(screen.queryAllByLabelText("New recurring expense")).toHaveLength(0);
  });

  it("short column at 1.3x keeps every action reachable", async () => {
    mockFontScale = 1.3;
    seedRule();
    await render(
      <InTabs>
        <RecurringList selectedId={null} onBack={() => {}} onNew={() => {}} onSelect={() => {}} />
      </InTabs>,
    );
    expect(moreItems()).toEqual([...ADD_RECEIPT, "New"]);
  });

  it("Tax year folds Export into ⋯ with Add receipt first", async () => {
    await render(
      <InTabs>
        <CollectionScreen kind="taxYear" year={2026} />
      </InTabs>,
    );
    expect(moreItems()).toEqual([...ADD_RECEIPT, "Export"]);
  });
});

describe("tall column (iOS, Duo upright)", () => {
  beforeEach(() => {
    mockHeight = 874;
  });

  it("Recurring keeps New and the + in the header, no ⋯", async () => {
    seedRule();
    await render(
      <InTabs>
        <RecurringList selectedId={null} onBack={() => {}} onNew={() => {}} onSelect={() => {}} />
      </InTabs>,
    );
    expect(screen.queryByLabelText("More")).toBeNull();
    expect(screen.getByRole("button", { name: "New recurring expense" })).toBeTruthy();
    expect(screen.getAllByLabelText("Add receipt")).toHaveLength(1);
  });

  it("Tax year keeps Export and the + in the header, no ⋯", async () => {
    await render(
      <InTabs>
        <CollectionScreen kind="taxYear" year={2026} />
      </InTabs>,
    );
    expect(screen.queryByLabelText("More")).toBeNull();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
    expect(screen.getAllByLabelText("Add receipt")).toHaveLength(1);
  });
});
