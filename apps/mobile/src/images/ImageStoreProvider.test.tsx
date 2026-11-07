import { act, render } from "@testing-library/react-native";
import { AppState } from "react-native";

import { ImageStoreProvider } from "./ImageStoreProvider";

const mockPurgeDecrypted = jest.fn(async () => undefined);
const mockPurgeExport = jest.fn(async (_fs: unknown) => undefined);
const mockRemoveDir = jest.fn(async (_d: string) => undefined);

const mockDbObj = {};
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDbObj }));
jest.mock("@/db/repositories/pages", () => ({ listAllPagePaths: () => [] }));
jest.mock("@/crypto/keys", () => ({
  getOrCreateMasterKey: async () => new Uint8Array(32),
  deriveKey: () => new Uint8Array(32),
}));
jest.mock("@/crypto/secureStore", () => ({ expoSecretStore: {} }));
jest.mock("./expoFs", () => ({ expoFs: { cacheDir: "file:///cache/", removeDir: (d: string) => mockRemoveDir(d) } }));
jest.mock("./expoManipulate", () => ({ expoManipulate: jest.fn() }));
jest.mock("@/export/files", () => ({ purgeExportFiles: (fs: unknown) => mockPurgeExport(fs) }));
jest.mock("./store", () => ({
  createImageStore: () => ({
    cleanupOrphanPages: async () => 0,
    purgeDecryptedCache: mockPurgeDecrypted,
    purgeCaptureSources: async () => undefined,
  }),
}));

describe("ImageStoreProvider export file lifecycle", () => {
  let change: ((s: string) => void) | undefined;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, cb: (s: string) => void) => {
      change = cb;
      return { remove: () => undefined };
    }) as never);
  });

  it("cold-start mount purges export files once; background purge does not touch them", async () => {
    await render(<ImageStoreProvider>{null}</ImageStoreProvider>);
    await act(async () => {});
    expect(mockPurgeExport).toHaveBeenCalledTimes(1);
    expect(mockPurgeDecrypted).toHaveBeenCalledTimes(1);
    act(() => change!("background"));
    expect(mockPurgeDecrypted).toHaveBeenCalledTimes(2);
    expect(mockPurgeExport).toHaveBeenCalledTimes(1);
  });
});
