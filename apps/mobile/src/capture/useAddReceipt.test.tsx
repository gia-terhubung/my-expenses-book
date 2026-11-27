import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert, Pressable, Text } from "react-native";

import { initI18n } from "@/i18n";

import { useAddReceipt } from "./useAddReceipt";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// iOS reports the sheet choice from the modal's onDismiss; fire it when the sheet hides.
jest.mock("@/components/AppModal", () => {
  const { useEffect, useRef } = jest.requireActual("react");
  return {
    AppModal: ({ visible, onDismiss, children }: { visible: boolean; onDismiss?: () => void; children: React.ReactNode }) => {
      const was = useRef(visible);
      useEffect(() => {
        if (was.current && !visible) onDismiss?.();
        was.current = visible;
      }, [visible, onDismiss]);
      return visible ? children : null;
    },
  };
});
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock, router: { push: jest.fn() } }));
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => "db" }));
jest.mock("@/prefs/PrefsProvider", () => ({ usePref: () => "IDR" }));
const mockCreateManualDraft = jest.fn((..._args: unknown[]) => "draft-1");
jest.mock("@/dates/clock", () => ({
  ...jest.requireActual("@/dates/clock"),
  now: () => new Date("2026-10-26T03:00:00Z"),
}));
jest.mock("@/review/manualDraft", () => ({ createManualDraft: (...a: unknown[]) => mockCreateManualDraft(...a) }));
let mockMayStart = true;
jest.mock("./captureGate", () => ({
  mayStartCapture: (tell: (k: string) => void) => (mockMayStart ? true : (tell("capture.restoreRunning"), false)),
}));

function Host() {
  const add = useAddReceipt();
  return (
    <>
      <Pressable accessibilityRole="button" onPress={add.open}>
        <Text>open</Text>
      </Pressable>
      {add.sheet}
    </>
  );
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockMayStart = true;
  mockCreateManualDraft.mockClear();
  (router.push as jest.Mock).mockClear();
});

describe("useAddReceipt", () => {
  it("open() shows the add sheet", async () => {
    await render(<Host />);
    expect(screen.queryByTestId("capture-sheet")).toBeNull();
    await fireEvent.press(screen.getByText("open"));
    expect(screen.getByTestId("capture-sheet")).toBeTruthy();
  });

  it("manual creates a draft in the home currency, dated by the app clock, and opens its review", async () => {
    await render(<Host />);
    await fireEvent.press(screen.getByText("open"));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Add manually" })));
    expect(mockCreateManualDraft).toHaveBeenCalledWith("db", { home: "IDR", now: new Date("2026-10-26T03:00:00Z") });
    expect(router.push).toHaveBeenCalledWith({ pathname: "/review/[id]", params: { id: "draft-1", queue: "" } });
    expect(screen.queryByTestId("capture-sheet")).toBeNull();
  });

  it("a running restore blocks capture with a message", async () => {
    mockMayStart = false;
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<Host />);
    await fireEvent.press(screen.getByText("open"));
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Add manually" })));
    expect(alert).toHaveBeenCalledWith("A restore is in progress. Try again when it finishes.");
    expect(mockCreateManualDraft).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
