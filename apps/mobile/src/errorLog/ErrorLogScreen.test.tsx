import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import { initI18n } from "@/i18n";
import type { FileOps } from "@/images/store";
import type { KV } from "@/prefs/prefs";

import { createErrorLog } from "./errorLog";
import { ErrorLogScreen } from "./ErrorLogScreen";
import { useAndroidPlatform } from "../../test/androidPlatform";

// Native header and sheet toolbars render as plain views; router calls are recorded.
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock,
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ addListener: () => () => {}, setOptions: jest.fn() }),
  usePreventRemove: jest.fn(),
}));

const mockShare = jest.fn();
jest.mock("expo-sharing", () => ({ shareAsync: (...a: unknown[]) => mockShare(...a) }));
jest.mock("@/images/expoFs", () => ({ expoFs: {} }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

function memoryKV(): KV {
  const m = new Map<string, string>();
  return { getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), delete: (k) => void m.delete(k) };
}

function fakeFs() {
  const files = new Map<string, Uint8Array>();
  const fs: FileOps = {
    documentDir: "file:///doc/",
    cacheDir: "file:///cache/",
    read: async (u) => files.get(u)!,
    exists: async (u) => files.has(u),
    write: async (u, b) => void files.set(u, b),
    remove: async (u) => void files.delete(u),
    list: async () => [],
    removeDir: async () => {},
  };
  return { fs, files };
}

const now = () => new Date(2026, 10, 16, 9, 0, 0);

beforeAll(() => initI18n("en"));
beforeEach(() => mockShare.mockReset().mockResolvedValue(undefined));

// The in-page header and footer are Android's; iOS uses the native header (ScreenHeader.test).
useAndroidPlatform();

describe("ErrorLogScreen", () => {
  it("shows the empty copy when nothing is logged", async () => {
    await render(<ErrorLogScreen log={createErrorLog(memoryKV())} fs={fakeFs().fs} now={now} appVersion="1.0.0" />);
    expect(screen.getByText("No errors recorded.")).toBeTruthy();
  });

  it("lists entries", async () => {
    const log = createErrorLog(memoryKV());
    log.append("render", new Error("boom one"));
    log.append("backup.postCommit", new Error("boom two"));
    await render(<ErrorLogScreen log={log} fs={fakeFs().fs} now={now} appVersion="1.0.0" />);
    expect(screen.getByText("boom one")).toBeTruthy();
    expect(screen.getByText("boom two")).toBeTruthy();
  });

  it("exports errors-<date>.txt under cache/export and shares it", async () => {
    const log = createErrorLog(memoryKV());
    log.append("render", new Error("boom"));
    const { fs, files } = fakeFs();
    await render(<ErrorLogScreen log={log} fs={fs} now={now} appVersion="1.0.0" />);
    await fireEvent.press(screen.getByText("Export"));
    const uri = "file:///cache/export/errors-2026-11-16.txt";
    expect(Buffer.from(files.get(uri)!).toString("utf8")).toContain("My Expenses Book 1.0.0");
    expect(mockShare).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: "text/plain" }));
  });

  it("asks before clearing, then empties the list", async () => {
    const log = createErrorLog(memoryKV());
    log.append("render", new Error("boom"));
    const alert = jest.spyOn(Alert, "alert");
    await render(<ErrorLogScreen log={log} fs={fakeFs().fs} now={now} appVersion="1.0.0" />);
    await fireEvent.press(screen.getByText("Clear log"));
    const buttons = alert.mock.calls[0][2]!;
    const destructive = buttons.find((b) => b.style === "destructive")!;
    await act(async () => destructive.onPress!());
    expect(log.list()).toEqual([]);
    expect(screen.getByText("No errors recorded.")).toBeTruthy();
  });

  it("renders a full log of deep stacks", async () => {
    const log = createErrorLog(memoryKV());
    for (let i = 0; i < 200; i++) {
      const e = new Error(`e${i}`);
      e.stack = Array.from({ length: 20 }, (_, j) => `at f${j}`).join("\n");
      log.append("s", e);
    }
    await expect(render(<ErrorLogScreen log={log} fs={fakeFs().fs} now={now} appVersion="1.0.0" />)).resolves.toBeTruthy();
  });

  it("pads the list end by the bottom inset", async () => {
    await render(<ErrorLogScreen log={createErrorLog(memoryKV())} fs={fakeFs().fs} now={now} appVersion="1.0.0" />);
    expect(screen.getByTestId("error-log-list").props.contentContainerStyle.paddingBottom).toBe(34 + 24);
  });

  it("has the shared page header: Back chevron and title, no native header inset", async () => {
    await render(<ErrorLogScreen log={createErrorLog(memoryKV())} fs={fakeFs().fs} now={now} appVersion="1.0.0" />);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Error log" })).toBeTruthy();
    expect(screen.getByTestId("error-log-list").props.contentInsetAdjustmentBehavior).toBe("never");
    // Same 16 pt side margin as every page with the shared header, so the chevron lines up.
    expect(screen.getByTestId("error-log-list").props.contentContainerStyle.paddingHorizontal).toBe(16);
  });
});
