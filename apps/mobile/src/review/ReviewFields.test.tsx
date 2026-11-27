import { fireEvent, render, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

import { initI18n } from "@/i18n";
import { NativeSheetPage, SheetRouteContext } from "@/layout/NativeSheet";

import { CurrencyField } from "./ReviewFields";

/**
 * The currency sheet of the review/edit form (and Export). On iOS it opens as a native sheet page,
 * so its X sits in Apple's bar and moves into the iPhone Duo side column; elsewhere, today's modal.
 */
const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock,
  router: {
    push: (...a: unknown[]) => mockRouter.push(...a),
    back: () => mockRouter.back(),
  },
}));
// Category chips read the DB; the real provider needs native storage. Not used by CurrencyField.
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const originalOS = Platform.OS;
beforeAll(() => initI18n("en"));
beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  Platform.OS = originalOS;
});

describe("CurrencyField", () => {
  it("iOS in the modals stack: opens the /picker sheet page with X; choosing sets the value and closes", async () => {
    const onChange = jest.fn();
    await render(
      <>
        <SheetRouteContext.Provider value="/picker">
          <CurrencyField label="Currency" value="USD" onChange={onChange} />
        </SheetRouteContext.Provider>
        <NativeSheetPage />
      </>,
    );
    await fireEvent.press(screen.getByRole("button", { name: /^Currency/ }));
    expect(mockRouter.push).toHaveBeenCalledWith("/picker");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    // The list is virtualized: pick the first row it renders.
    const row = screen.getAllByLabelText(/^[A-Z]{3}\b/)[0];
    const code = (row.props.accessibilityLabel as string).slice(0, 3);
    await fireEvent.press(row);
    expect(onChange).toHaveBeenCalledWith(code);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("iOS: X closes without changing the value", async () => {
    const onChange = jest.fn();
    await render(
      <>
        <SheetRouteContext.Provider value="/picker">
          <CurrencyField label="Currency" value="USD" onChange={onChange} />
        </SheetRouteContext.Provider>
        <NativeSheetPage />
      </>,
    );
    await fireEvent.press(screen.getByRole("button", { name: /^Currency/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("Android: today's modal sheet, no sheet page", async () => {
    Platform.OS = "android";
    await render(
      <SheetRouteContext.Provider value="/picker">
        <CurrencyField label="Currency" value="USD" onChange={jest.fn()} />
      </SheetRouteContext.Provider>,
    );
    await fireEvent.press(screen.getByRole("button", { name: /^Currency/ }));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  });

  it("outside any sheet-capable stack: today's modal sheet", async () => {
    await render(<CurrencyField label="Currency" value="USD" onChange={jest.fn()} />);
    await fireEvent.press(screen.getByRole("button", { name: /^Currency/ }));
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
  });
});
