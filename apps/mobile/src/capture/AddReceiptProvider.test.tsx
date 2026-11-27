import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Pressable, Text } from "react-native";

import { initI18n } from "@/i18n";

import { AddReceiptProvider, useAddReceiptContext } from "./AddReceiptProvider";

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
jest.mock("@/review/manualDraft", () => ({ createManualDraft: (...a: unknown[]) => mockCreateManualDraft(...a) }));
let mockMayStart = true;
jest.mock("./captureGate", () => ({
  mayStartCapture: (tell: (k: string) => void) => (mockMayStart ? true : (tell("capture.restoreRunning"), false)),
}));

function OpenButton({ label }: { label: string }) {
  const add = useAddReceiptContext();
  return (
    <Pressable accessibilityRole="button" onPress={add.open}>
      <Text>{label}</Text>
    </Pressable>
  );
}

function ManualButton() {
  const add = useAddReceiptContext();
  return (
    <Pressable accessibilityRole="button" onPress={() => void add.start("manual")}>
      <Text>manual</Text>
    </Pressable>
  );
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockMayStart = true;
  mockCreateManualDraft.mockClear();
  (router.push as jest.Mock).mockClear();
});

describe("AddReceiptProvider", () => {
  it("two consumers share one sheet: open() from either shows exactly one capture-sheet", async () => {
    await render(
      <AddReceiptProvider>
        <OpenButton label="first" />
        <OpenButton label="second" />
      </AddReceiptProvider>,
    );
    await fireEvent.press(screen.getByText("first"));
    await fireEvent.press(screen.getByText("second"));
    expect(screen.getAllByTestId("capture-sheet")).toHaveLength(1);
  });

  it("start('manual') runs the shared flow", async () => {
    await render(
      <AddReceiptProvider>
        <ManualButton />
      </AddReceiptProvider>,
    );
    await act(async () => fireEvent.press(screen.getByText("manual")));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/review/[id]", params: { id: "draft-1", queue: "" } });
  });

  it("throws outside the provider", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await expect(render(<OpenButton label="x" />)).rejects.toThrow(
      "useAddReceiptContext must be used inside AddReceiptProvider",
    );
    spy.mockRestore();
  });
});
