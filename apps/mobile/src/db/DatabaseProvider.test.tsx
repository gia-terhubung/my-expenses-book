import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { initI18n } from "@/i18n";
import { DbNotEncryptedError, DbKeyMismatchError } from "./client";
import { MasterKeyCorruptError } from "@/crypto/keys";

import { DatabaseProvider } from "./DatabaseProvider";

const mockOpen = jest.fn();
const mockReset = jest.fn();

jest.mock("./client", () => {
  const actual = jest.requireActual("./client");
  return {
    ...actual,
    openWithStore: (...a: unknown[]) => mockOpen(...a),
    resetLocalData: (...a: unknown[]) => mockReset(...a),
  };
});
jest.mock("@/crypto/secureStore", () => ({ expoSecretStore: {} }));
jest.mock("@/prefs/storage", () => ({ deletePrefsStorage: jest.fn() }));
jest.mock("drizzle-orm/expo-sqlite/migrator", () => ({ migrate: jest.fn() }));
const mockSafeMigrate = jest.fn();
jest.mock("./safeMigrate", () => ({
  pendingMigrationCount: () => () => 0,
  safeMigrate: (...a: unknown[]) => mockSafeMigrate(...a),
}));
jest.mock("./expoDbFiles", () => ({ expoDbFiles: {} }));
jest.mock("./migrations/migrations", () => ({ __esModule: true, default: { journal: { entries: [] }, migrations: {} } }));
jest.mock("react-native-quick-crypto", () => ({}));

const fakeDb = { $client: { closeSync: jest.fn() } };

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockOpen.mockReset();
  mockReset.mockReset();
  mockSafeMigrate.mockReset().mockResolvedValue({ status: "ok" });
  fakeDb.$client.closeSync.mockClear();
});

async function renderProvider() {
  return render(
    <DatabaseProvider>
      <Text>child</Text>
    </DatabaseProvider>,
  );
}

async function showLocked() {
  mockOpen.mockRejectedValueOnce(new DbKeyMismatchError());
  await renderProvider();
  await screen.findByText("Your data can't be unlocked");
}

describe("DatabaseProvider", () => {
  it("renders children once open", async () => {
    mockOpen.mockResolvedValueOnce(fakeDb);
    await renderProvider();
    expect(await screen.findByText("child")).toBeTruthy();
  });

  it("shows the db-error screen on DbKeyMismatchError", async () => {
    await showLocked();
    expect(screen.getByText("Reset data")).toBeTruthy();
  });

  it("shows the db-error screen on MasterKeyCorruptError", async () => {
    mockOpen.mockRejectedValueOnce(new MasterKeyCorruptError());
    await renderProvider();
    expect(await screen.findByText("Your data can't be unlocked")).toBeTruthy();
  });

  it("keeps Reset disabled until RESET is typed", async () => {
    await showLocked();
    const input = screen.getByPlaceholderText("RESET");
    const button = () => screen.getByRole("button", { name: "Reset data" });
    expect(button()).toBeDisabled();
    await fireEvent.changeText(input, "RESE");
    expect(button()).toBeDisabled();
    await fireEvent.changeText(input, "RESET");
    expect(button()).toBeEnabled();
  });

  it("reset calls resetLocalData, re-opens, then renders children", async () => {
    await showLocked();
    mockReset.mockResolvedValueOnce(undefined);
    mockOpen.mockResolvedValueOnce(fakeDb);
    await fireEvent.changeText(screen.getByPlaceholderText("RESET"), "RESET");
    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Reset data" }));
    });
    expect(await screen.findByText("child")).toBeTruthy();
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledTimes(2);
  });

  it("a reset failure shows the failed state with Retry", async () => {
    await showLocked();
    mockReset.mockRejectedValueOnce(new Error("disk full"));
    await fireEvent.changeText(screen.getByPlaceholderText("RESET"), "RESET");
    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Reset data" }));
    });
    expect(await screen.findByText("Reset failed.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("DbNotEncryptedError shows the failed state, details hidden until toggled, Retry reopens", async () => {
    mockOpen.mockRejectedValueOnce(new DbNotEncryptedError());
    await renderProvider();
    expect(await screen.findByText("Could not open your data.")).toBeTruthy();
    expect(screen.queryByText(/SQLCipher is not available/)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Show details" }));
    expect(screen.getByText(/SQLCipher is not available/)).toBeTruthy();
    mockOpen.mockResolvedValueOnce(fakeDb);
    await act(async () => {
      await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    });
    await waitFor(() => expect(screen.getByText("child")).toBeTruthy());
  });

  it("closes a db that resolves after unmount", async () => {
    let resolve!: (d: unknown) => void;
    mockOpen.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const view = await renderProvider();
    await view.unmount();
    await act(async () => resolve(fakeDb));
    expect(fakeDb.$client.closeSync).toHaveBeenCalledTimes(1);
  });

  it("closes the open db on unmount", async () => {
    mockOpen.mockResolvedValueOnce(fakeDb);
    const view = await renderProvider();
    await screen.findByText("child");
    await view.unmount();
    expect(fakeDb.$client.closeSync).toHaveBeenCalledTimes(1);
  });

  describe("migrations", () => {
    it("restored: shows the safe-data message, closes the reopened db on Retry, reopens", async () => {
      const reopened = { $client: { closeSync: jest.fn() } };
      mockSafeMigrate.mockImplementationOnce(async (opts: { reopen: () => Promise<unknown> }) => {
        await opts.reopen();
        return { status: "restored", error: new Error("no such column"), db: reopened };
      });
      mockOpen.mockResolvedValueOnce(fakeDb).mockResolvedValueOnce(reopened).mockResolvedValueOnce(fakeDb);
      await renderProvider();
      expect(
        await screen.findByText(
          "The update couldn't upgrade your data. Your receipts are safe. Please update the app again or contact support.",
        ),
      ).toBeTruthy();
      expect(screen.queryByText("child")).toBeNull();
      expect(mockOpen).toHaveBeenCalledTimes(2);
      await act(async () => {
        await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
      });
      expect(await screen.findByText("child")).toBeTruthy();
      expect(reopened.$client.closeSync).toHaveBeenCalledTimes(1);
      expect(mockOpen).toHaveBeenCalledTimes(3);
    });

    it("noSpace: shows the free-space message and never renders children", async () => {
      mockSafeMigrate.mockResolvedValueOnce({ status: "noSpace", error: new Error("ENOSPC") });
      mockOpen.mockResolvedValueOnce(fakeDb);
      await renderProvider();
      expect(
        await screen.findByText(
          "Not enough free space to update your data safely. Free up some space and open the app again.",
        ),
      ).toBeTruthy();
      expect(screen.queryByText("child")).toBeNull();
    });

    it("a failed reopen after a restore shows the open-failed state", async () => {
      mockSafeMigrate.mockImplementationOnce(async (opts: { reopen: () => Promise<unknown> }) => opts.reopen());
      mockOpen.mockResolvedValueOnce(fakeDb).mockRejectedValueOnce(new Error("cannot open"));
      await renderProvider();
      expect(await screen.findByText("Could not open your data.")).toBeTruthy();
    });

    it("any other migration error shows the migration-failed state", async () => {
      mockSafeMigrate.mockRejectedValueOnce(new Error("bad sql"));
      mockOpen.mockResolvedValueOnce(fakeDb);
      await renderProvider();
      expect(await screen.findByText("Updating your data failed.")).toBeTruthy();
    });
  });
});
