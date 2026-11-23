import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import { captureLease } from "@/images/captureLease";
import type { FileOps } from "@/images/store";
import * as money from "@/money/money";

import { BackupScreen } from "./BackupScreen";
import {
  ArchiveFormatError,
  ArchiveIncompleteError,
  ArchiveTooOldError,
  ArchiveVersionError,
  WrongPassphraseError,
} from "./errors";
import { restoreLease } from "./restoreLease";

let mockDb: AppDb;
const mockPrefsMap: Record<string, unknown> = {};
const mockSet = jest.fn((k: string, v: unknown) => {
  mockPrefsMap[k] = v;
});
const mockPush = jest.fn();
const mockShare = jest.fn();
const mockPick = jest.fn();
const mockExport = jest.fn();
const mockImport = jest.fn();
const mockOpen = jest.fn();
const mockUnlock = jest.fn();
const mockSourceClose = jest.fn(async () => undefined);

jest.mock("react-native-quick-crypto", () => ({ scrypt: jest.fn() }));
jest.mock("expo-sharing", () => ({ shareAsync: (...a: unknown[]) => mockShare(...a) }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: (...a: unknown[]) => mockPick(...a) }));
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => ({}) }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => mockPrefsMap[k] ?? null,
  usePrefs: () => ({ set: mockSet, get: (k: string) => mockPrefsMap[k] }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Latest usePreventRemove call: whether leaving the screen is blocked.
let mockPrevent: { prevent: boolean; cb?: () => void } = { prevent: false };
jest.mock("expo-router", () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  usePreventRemove: (prevent: boolean, cb?: () => void) => {
    mockPrevent = { prevent, cb };
  },
}));
jest.mock("./expoBytes", () => ({
  fileOpsSink: (u: string) => ({ uri: u }),
  fileSource: (u: string) => ({ uri: u, close: mockSourceClose }),
}));
jest.mock("./exportBackup", () => ({ exportBackup: (...a: unknown[]) => mockExport(...a) }));
jest.mock("./importBackup", () => ({ importBackup: (...a: unknown[]) => mockImport(...a) }));
jest.mock("./container", () => ({ openArchive: (...a: unknown[]) => mockOpen(...a) }));

const removed: string[] = [];
const fs = {
  documentDir: "file:///doc/",
  cacheDir: "file:///cache/",
  removeDir: jest.fn(async () => undefined),
  remove: jest.fn(async (u: string) => {
    removed.push(u);
  }),
} as unknown as FileOps;

const now = () => new Date(2026, 10, 7, 12);
const PASS = "correct horse";

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  jest.clearAllMocks();
  removed.length = 0;
  for (const k of Object.keys(mockPrefsMap)) delete mockPrefsMap[k];
  mockPrefsMap.receiptsSinceBackup = 5;
  mockPrefsMap.lastBackupAt = 111;
  mockShare.mockResolvedValue(undefined);
  mockExport.mockResolvedValue({ pages: 0, missing: [] });
  mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/DocumentPicker/x.meb" }] });
  mockOpen.mockResolvedValue({ header: { format: 1, encrypted: true }, unlock: mockUnlock });
  mockUnlock.mockResolvedValue({});
  mockImport.mockResolvedValue({
    result: { inserted: 3, updated: 2, kept: 0, insertedReceiptIds: [] },
    possibleDuplicates: [],
  });
});

const btn = (name: string) => screen.getByRole("button", { name });
const fill = async (p: string, c: string) => {
  await fireEvent.changeText(screen.getByLabelText("Passphrase"), p);
  await fireEvent.changeText(screen.getByLabelText("Confirm passphrase"), c);
};
const alertButtons = (spy: jest.SpyInstance) => spy.mock.calls[0][2] as AlertButton[];

describe("backup", () => {
  it("mismatch disables Back up now", async () => {
    await render(<BackupScreen fs={fs} now={now} />);
    await fill(PASS, PASS + "x");
    expect(btn("Back up now").props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText("Passphrases don't match.")).toBeTruthy();
  });

  it("mismatch message waits for the confirm field", async () => {
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.changeText(screen.getByLabelText("Passphrase"), PASS);
    expect(screen.queryByText("Passphrases don't match.")).toBeNull();
  });

  it("clears passphrase fields after an attempt", async () => {
    await render(<BackupScreen fs={fs} now={now} />);
    await fill(PASS, PASS);
    await fireEvent.press(btn("Back up now"));
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText("Passphrase").props.value).toBe(""));
    expect(screen.getByLabelText("Confirm passphrase").props.value).toBe("");
  });

  it("double tap starts one export", async () => {
    await render(<BackupScreen fs={fs} now={now} />);
    await fill(PASS, PASS);
    await act(async () => {
      fireEvent.press(btn("Back up now"));
      fireEvent.press(btn("Back up now"));
    });
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect(mockExport).toHaveBeenCalledTimes(1);
  });

  it("shows never when no backup yet", async () => {
    mockPrefsMap.lastBackupAt = null;
    await render(<BackupScreen fs={fs} now={now} />);
    expect(screen.getByText("Never backed up")).toBeTruthy();
  });

  it("successful share updates prefs", async () => {
    await render(<BackupScreen fs={fs} now={now} />);
    await fill(PASS, PASS);
    await fireEvent.press(btn("Back up now"));
    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("receiptsSinceBackup", 0));
    expect(mockSet).toHaveBeenCalledWith("lastBackupAt", now().getTime());
    expect(mockExport.mock.calls[0][0].passphrase).toBe(PASS);
    expect(mockShare.mock.calls[0][0]).toBe("file:///cache/export/MyExpensesBook-backup-2026-11-07.meb");
  });

  it("share rejection leaves prefs and shows error", async () => {
    mockShare.mockRejectedValue(new Error("nope"));
    await render(<BackupScreen fs={fs} now={now} />);
    await fill(PASS, PASS);
    await fireEvent.press(btn("Back up now"));
    expect(await screen.findByText("Backup failed")).toBeTruthy();
    expect(mockSet).not.toHaveBeenCalled();
    expect(removed).toEqual(["file:///cache/export/MyExpensesBook-backup-2026-11-07.meb"]);
  });

  it("export failure deletes the partial file", async () => {
    mockExport.mockRejectedValue(new Error("disk"));
    await render(<BackupScreen fs={fs} now={now} />);
    await fill(PASS, PASS);
    await fireEvent.press(btn("Back up now"));
    expect(await screen.findByText("Backup failed")).toBeTruthy();
    expect(removed).toEqual(["file:///cache/export/MyExpensesBook-backup-2026-11-07.meb"]);
    expect(mockShare).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("clears only cache/export before writing, never a picked backup", async () => {
    await render(<BackupScreen fs={fs} now={now} />);
    await fill(PASS, PASS);
    await fireEvent.press(btn("Back up now"));
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect((fs.removeDir as jest.Mock).mock.calls).toEqual([["file:///cache/export/"]]);
  });

  it("blocks leaving the screen while a backup runs", async () => {
    let finish!: () => void;
    mockExport.mockReturnValue(new Promise<void>((r) => (finish = r)));
    await render(<BackupScreen fs={fs} now={now} />);
    expect(mockPrevent.prevent).toBe(false);
    await fill(PASS, PASS);
    await fireEvent.press(btn("Back up now"));
    await waitFor(() => expect(mockPrevent.prevent).toBe(true));
    await act(async () => finish());
    await waitFor(() => expect(mockPrevent.prevent).toBe(false));
  });

  it("skip passphrase only proceeds on Continue", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Back up without passphrase"));
    expect(alert.mock.calls[0][1]).toMatch(/Without a passphrase/);
    expect(mockExport).not.toHaveBeenCalled();
    await act(async () => {
      await alertButtons(alert).find((b) => b.style === "destructive")!.onPress!();
    });
    await waitFor(() => expect(mockShare).toHaveBeenCalled());
    expect(mockExport.mock.calls[0][0].passphrase).toBeNull();
    alert.mockRestore();
  });
});

describe("restore", () => {
  it("picker cancel does nothing", async () => {
    mockPick.mockResolvedValue({ canceled: true, assets: null });
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    await waitFor(() => expect(mockPick).toHaveBeenCalled());
    expect(mockOpen).not.toHaveBeenCalled();
    expect(removed).toEqual([]);
  });

  it.each([
    [new ArchiveFormatError("x"), "This file isn't a My Expenses Book backup."],
    [new ArchiveVersionError("x"), "This backup was made by a newer version of the app. Update the app to restore it."],
    [new ArchiveIncompleteError([]), "This backup file is damaged or incomplete."],
    [new ArchiveTooOldError("x"), "This backup was made by an older version of the app and couldn't be read."],
  ])("maps %p", async (err, copy) => {
    mockOpen.mockRejectedValue(err);
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    expect(await screen.findByText(copy)).toBeTruthy();
    expect(removed).toEqual(["file:///cache/DocumentPicker/x.meb"]);
    expect(mockSourceClose).toHaveBeenCalled();
  });

  it("unmount in the choose stage deletes the picker copy", async () => {
    mockOpen.mockResolvedValue({ header: { format: 1, encrypted: false }, unlock: mockUnlock });
    const { unmount } = await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    await screen.findByRole("button", { name: /^Merge/ });
    removed.length = 0;
    await unmount();
    await waitFor(() => expect(removed).toEqual(["file:///cache/DocumentPicker/x.meb"]));
  });

  it("unmount in the passphrase stage closes the open source", async () => {
    const { unmount } = await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    await screen.findByLabelText("Enter the backup passphrase");
    mockSourceClose.mockClear();
    await unmount();
    await waitFor(() => expect(mockSourceClose).toHaveBeenCalledTimes(1));
    expect(removed).toEqual(["file:///cache/DocumentPicker/x.meb"]);
  });

  it("refuses while a capture is in progress", async () => {
    const release = captureLease.acquire();
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    expect(await screen.findByText("Finish the scan in progress first.")).toBeTruthy();
    expect(mockPick).not.toHaveBeenCalled();
    release();
  });

  it("wrong passphrase shows inline error and allows retry", async () => {
    mockUnlock.mockRejectedValueOnce(new WrongPassphraseError());
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    await fireEvent.changeText(await screen.findByLabelText("Enter the backup passphrase"), "bad pass 1");
    await fireEvent.press(btn("Unlock"));
    expect(await screen.findByText("Wrong passphrase")).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText("Enter the backup passphrase"), PASS);
    await fireEvent.press(btn("Unlock"));
    expect(await screen.findByRole("button", { name: /^Merge/ })).toBeTruthy();
  });

  it("unprotected backup shows the note", async () => {
    mockOpen.mockResolvedValue({ header: { format: 1, encrypted: false }, unlock: mockUnlock });
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    expect(await screen.findByText("This backup isn't protected by a passphrase.")).toBeTruthy();
  });

  it("merge shows counts and duplicate rows that open the document", async () => {
    const rec = createReceipt(mockDb, {
      status: "confirmed",
      merchant: "Warung Sari",
      purchasedAtLocal: "2026-05-10T10:00:00",
      purchasedTz: "Asia/Jakarta",
      purchasedAtUtc: Date.UTC(2026, 4, 10),
      scannedAtUtc: Date.UTC(2026, 4, 10),
      currency: "IDR",
      totalMinor: 50000,
      homeCurrencyAtSave: "IDR",
      amountHomeMinor: 50000,
      parseSource: "manual",
      folderId: null,
    });
    mockImport.mockResolvedValue({
      result: { inserted: 3, updated: 2, kept: 0, insertedReceiptIds: [] },
      possibleDuplicates: [
        { receiptId: rec.id, matchId: "m1" },
        { receiptId: "gone", matchId: "m2" },
      ],
    });
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    await fireEvent.changeText(await screen.findByLabelText("Enter the backup passphrase"), PASS);
    await fireEvent.press(btn("Unlock"));
    await fireEvent.press(await screen.findByRole("button", { name: /^Merge/ }));
    expect(await screen.findByText("Added 3, updated 2")).toBeTruthy();
    expect(mockImport.mock.calls[0][0]).toMatchObject({ mode: "merge", passphrase: PASS });
    expect(screen.getByText("Possible duplicates (1)")).toBeTruthy();
    expect(screen.getByText(/Warung Sari · .*500/)).toBeTruthy();
    expect(screen.queryByTestId("dup-gone")).toBeNull();
    await fireEvent.press(screen.getByTestId(`dup-${rec.id}`));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/document/[id]", params: { id: rec.id } });
    expect(removed).toEqual(["file:///cache/DocumentPicker/x.meb"]);
  });

  it("replace requires the Alert confirm", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    await fireEvent.changeText(await screen.findByLabelText("Enter the backup passphrase"), PASS);
    await fireEvent.press(btn("Unlock"));
    await fireEvent.press(await screen.findByRole("button", { name: /^Replace/ }));
    expect(alert.mock.calls[0][1]).toMatch(/Replace everything on this device/);
    expect(mockImport).not.toHaveBeenCalled();
    await act(async () => {
      await alertButtons(alert).find((b) => b.style === "destructive")!.onPress!();
    });
    expect(await screen.findByText("Restored 3 receipts")).toBeTruthy();
    expect(mockImport.mock.calls[0][0]).toMatchObject({ mode: "replace" });
    alert.mockRestore();
  });

  it("backup actions are disabled while a restore is open (the picked file must survive)", async () => {
    mockOpen.mockResolvedValue({ header: { format: 1, encrypted: false }, unlock: mockUnlock });
    await render(<BackupScreen fs={fs} now={now} />);
    await fill(PASS, PASS);
    expect(btn("Back up now").props.accessibilityState?.disabled).toBe(false);
    await fireEvent.press(btn("Restore from backup"));
    await screen.findByRole("button", { name: /^Merge/ });
    expect(btn("Back up now").props.accessibilityState?.disabled).toBe(true);
    expect(btn("Back up without passphrase").props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(btn("Cancel"));
    await waitFor(() => expect(btn("Back up now").props.accessibilityState?.disabled).toBe(false));
  });

  it("while importing: leaving is blocked and the restore lease is held; unmount keeps the picked file until done", async () => {
    let finish!: (v: unknown) => void;
    mockImport.mockReturnValue(new Promise((r) => (finish = r)));
    mockOpen.mockResolvedValue({ header: { format: 1, encrypted: false }, unlock: mockUnlock });
    const { unmount } = await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    await fireEvent.press(await screen.findByRole("button", { name: /^Merge/ }));
    await waitFor(() => expect(mockImport).toHaveBeenCalled());
    expect(mockPrevent.prevent).toBe(true);
    expect(restoreLease.held()).toBe(true);
    await unmount();
    expect(removed).toEqual([]);
    await act(async () =>
      finish({ result: { inserted: 1, updated: 0, kept: 0, insertedReceiptIds: [] }, possibleDuplicates: [] }),
    );
    await waitFor(() => expect(removed).toEqual(["file:///cache/DocumentPicker/x.meb"]));
    expect(restoreLease.held()).toBe(false);
  });

  it("releases the restore lease when the import fails", async () => {
    mockImport.mockRejectedValue(new ArchiveIncompleteError([]));
    mockOpen.mockResolvedValue({ header: { format: 1, encrypted: false }, unlock: mockUnlock });
    await render(<BackupScreen fs={fs} now={now} />);
    await fireEvent.press(btn("Restore from backup"));
    await fireEvent.press(await screen.findByRole("button", { name: /^Merge/ }));
    expect(await screen.findByText("This backup file is damaged or incomplete.")).toBeTruthy();
    expect(restoreLease.held()).toBe(false);
    expect(mockPrevent.prevent).toBe(false);
  });

  it("a committed restore shows success even when a duplicate label can't be built", async () => {
    const rec = createReceipt(mockDb, {
      status: "confirmed",
      merchant: "Toko Contoh",
      purchasedAtLocal: "2026-05-10T10:00:00",
      purchasedAtUtc: Date.UTC(2026, 4, 10),
      scannedAtUtc: Date.UTC(2026, 4, 10),
      currency: "IDR",
      totalMinor: 50000,
      parseSource: "manual",
    });
    mockImport.mockResolvedValue({
      result: { inserted: 3, updated: 2, kept: 0, insertedReceiptIds: [] },
      possibleDuplicates: [{ receiptId: rec.id, matchId: "m1" }],
    });
    const spy = jest.spyOn(money, "formatMoney").mockImplementation(() => {
      throw new RangeError("Invalid currency code");
    });
    mockOpen.mockResolvedValue({ header: { format: 1, encrypted: false }, unlock: mockUnlock });
    try {
      await render(<BackupScreen fs={fs} now={now} />);
      await fireEvent.press(btn("Restore from backup"));
      await fireEvent.press(await screen.findByRole("button", { name: /^Merge/ }));
      expect(await screen.findByText("Added 3, updated 2")).toBeTruthy();
      expect(screen.getByTestId(`dup-${rec.id}`)).toBeTruthy();
      expect(screen.getByText("Toko Contoh")).toBeTruthy();
      expect(screen.queryByText("Restore failed")).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("has the shared page header: Back chevron and title, no native header inset", async () => {
    await render(<BackupScreen fs={fs} now={now} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("header", { name: "Backup & restore" })).toBeTruthy();
    expect(screen.getByTestId("backup-scroll").props.contentInsetAdjustmentBehavior).toBe("never");
  });
});
