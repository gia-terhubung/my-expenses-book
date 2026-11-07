import { randomBytes } from "node:crypto";

import { decryptBytes } from "./crypto";
import { createImageStore, isCaptureSource, type FileOps, type Manipulate } from "./store";

const DOC = "file:///doc/";
const CACHE = "file:///cache/";

function memFs() {
  const files = new Map<string, Uint8Array>();
  const fs: FileOps = {
    documentDir: DOC,
    cacheDir: CACHE,
    read: async (u) => {
      const b = files.get(u);
      if (!b) throw new Error("ENOENT " + u);
      return b;
    },
    write: async (u, b) => void files.set(u, b),
    remove: async (u) => void files.delete(u),
    list: async (dir) =>
      [...files.keys()].filter((k) => k.startsWith(dir)).map((k) => k.slice(dir.length)),
    removeDir: async (dir) => {
      for (const k of [...files.keys()]) if (k.startsWith(dir)) files.delete(k);
    },
  };
  return { fs, files };
}

const PLAIN_PAGE = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
const PLAIN_THUMB = new Uint8Array([0xff, 0xd8, 9, 0xff, 0xd9]);

function setup() {
  const { fs, files } = memFs();
  files.set(CACHE + "picked.jpg", new Uint8Array([7, 7, 7]));
  let n = 0;
  const manipulate: Manipulate = async (_src, o) => {
    const uri = `${CACHE}m${n++}.jpg`;
    files.set(uri, o.maxEdge === 1600 ? PLAIN_PAGE : PLAIN_THUMB);
    return { uri, width: o.maxEdge === 1600 ? 1200 : 240, height: o.maxEdge === 1600 ? 1600 : 320 };
  };
  const key = new Uint8Array(randomBytes(32));
  return { store: createImageStore({ key, fs, manipulate }), files, key };
}

describe("image store", () => {
  it("savePage writes two encrypted files and no plaintext under pages/", async () => {
    const { store, files, key } = setup();
    const r = await store.savePage(CACHE + "picked.jpg");
    expect(r.imagePath).toMatch(/^pages\/[0-9a-f-]+\.enc$/);
    expect(r.thumbPath).toMatch(/^pages\/[0-9a-f-]+\.enc$/);
    expect(r.imagePath).not.toBe(r.thumbPath);
    expect([r.width, r.height]).toEqual([1200, 1600]);
    const pageFiles = [...files.keys()].filter((k) => k.startsWith(DOC + "pages/"));
    expect(pageFiles).toHaveLength(2);
    for (const k of pageFiles) {
      const b = files.get(k)!;
      expect(String.fromCharCode(...b.slice(0, 4))).toBe("MEB1");
      expect(Array.from(b.slice(4, 4 + PLAIN_THUMB.length))).not.toEqual(Array.from(PLAIN_THUMB));
      expect(Array.from(b.slice(4, 4 + PLAIN_PAGE.length))).not.toEqual(Array.from(PLAIN_PAGE));
    }
    expect(Array.from(decryptBytes(key, files.get(DOC + r.imagePath)!))).toEqual(Array.from(PLAIN_PAGE));
    expect(Array.from(decryptBytes(key, files.get(DOC + r.thumbPath)!))).toEqual(Array.from(PLAIN_THUMB));
    // Only the work-dir plaintext remains (handed to OCR; caller deletes it).
    expect(r.normalizedUri.startsWith(CACHE + "work/")).toBe(true);
    expect(Array.from(files.get(r.normalizedUri)!)).toEqual(Array.from(PLAIN_PAGE));
    const plainLeft = [...files.keys()].filter((k) => k.startsWith(CACHE) && !k.endsWith("picked.jpg"));
    expect(plainLeft).toEqual([r.normalizedUri]);
  });

  it("openForView returns cache file with original bytes", async () => {
    const { store, files } = setup();
    const r = await store.savePage(CACHE + "picked.jpg");
    const uri = await store.openForView(r.imagePath);
    expect(uri.startsWith(CACHE + "view/")).toBe(true);
    expect(Array.from(files.get(uri)!)).toEqual(Array.from(PLAIN_PAGE));
  });

  it("openForView rejects paths outside pages/", async () => {
    const { store } = setup();
    await expect(store.openForView("../secret.enc")).rejects.toThrow();
    await expect(store.openForView("pages/../x.enc")).rejects.toThrow();
  });

  it("closeViews deletes the decrypted view copies of the given pages only", async () => {
    const { store, files } = setup();
    const a = await store.savePage(CACHE + "picked.jpg");
    const b = await store.savePage(CACHE + "picked.jpg");
    const va = await store.openForView(a.imagePath);
    const vb = await store.openForView(b.imagePath);
    await store.closeViews([a.imagePath, a.thumbPath]); // thumb never opened: no error
    expect(files.has(va)).toBe(false);
    expect(files.has(vb)).toBe(true);
    expect(files.has(DOC + a.imagePath)).toBe(true); // encrypted page untouched
    await expect(store.closeViews(["../x.enc"])).rejects.toThrow();
  });

  it("purgeDecryptedCache removes all view files", async () => {
    const { store, files } = setup();
    const r = await store.savePage(CACHE + "picked.jpg");
    await store.openForView(r.imagePath);
    await store.openForView(r.thumbPath);
    expect([...files.keys()].filter((k) => k.startsWith(CACHE + "view/"))).toHaveLength(2);
    files.set(CACHE + "ImageManipulator/stray.jpg", PLAIN_PAGE);
    await store.purgeDecryptedCache();
    expect([...files.keys()].filter((k) => k.startsWith(CACHE + "view/"))).toHaveLength(0);
    expect([...files.keys()].filter((k) => k.startsWith(CACHE) && !k.endsWith("picked.jpg"))).toEqual([]);
  });

  it("purgeDecryptedCache keeps capture work files while a capture holds the lease", async () => {
    const { store, files } = setup();
    const r = await store.savePage(CACHE + "picked.jpg");
    await store.openForView(r.imagePath);
    files.set(CACHE + "ImageManipulator/inflight.jpg", PLAIN_PAGE);
    await store.purgeDecryptedCache({ keepCaptureWork: true });
    expect([...files.keys()].filter((k) => k.startsWith(CACHE + "view/"))).toEqual([]);
    expect(files.has(r.normalizedUri)).toBe(true);
    expect(files.has(CACHE + "ImageManipulator/inflight.jpg")).toBe(true);
  });

  it("discardPlaintext removes allow-listed capture files only", async () => {
    const { store, files } = setup();
    const r = await store.savePage(CACHE + "picked.jpg");
    const keep = [
      CACHE + "picked.jpg", // cache root: not a capture dir
      CACHE + "view/x.jpg",
      DOC + "notes.jpg",
      DOC + r.imagePath,
      "file:///elsewhere/photo.jpg",
      CACHE + "ImagePicker/../view/x.jpg",
      CACHE + "ImagePicker/%2E%2E/view/x.jpg",
    ];
    const drop = [
      r.normalizedUri,
      CACHE + "ImagePicker/a.jpg",
      CACHE + "mlkit_docscan_ui_client/s.jpg",
      DOC + "DOCUMENT_SCAN_1_20261105_101010.jpg",
    ];
    for (const u of [...keep, ...drop]) files.set(u, PLAIN_PAGE);
    for (const u of [...keep, ...drop]) await store.discardPlaintext(u);
    for (const u of drop) expect(files.has(u)).toBe(false);
    for (const u of keep) expect(files.has(u)).toBe(true);
  });

  it("isCaptureSource allow-lists picker, scanner and work files, after normalizing", () => {
    const fs = { documentDir: "file:///var/mobile/App/Documents/", cacheDir: "file:///var/mobile/App/Library/Caches/" };
    const ok = [
      "file:///var/mobile/App/Library/Caches/ImagePicker/A1.jpg",
      "file:///private/var/mobile/App/Library/Caches/ImagePicker/A1.jpg",
      "/var/mobile/App/Library/Caches/ImagePicker/A1.jpg",
      "file:///var/mobile/App/Library/Caches/work/w.jpg",
      "file:///var/mobile/App/Library/Caches/mlkit_docscan_ui_client/p.jpg",
      "file:///private/var/mobile/App/Documents/DOCUMENT_SCAN_0_20261105_101010.jpg",
    ];
    const bad = [
      "file:///var/mobile/App/Library/Caches/ImagePicker/../view/v.jpg",
      "file:///var/mobile/App/Library/Caches/ImagePicker/%2E%2E/view/v.jpg",
      "file:///var/mobile/App/Library/Caches/ImagePicker/a%20b.jpg",
      "file:///var/mobile/App/Library/Caches/view/v.jpg",
      "file:///var/mobile/App/Library/Caches/ImagePicker/",
      "file:///var/mobile/App/Documents/pages/x.enc",
      "file:///var/mobile/App/Documents/notes.jpg",
      "content://com.other.app/secret/1",
      "file:///etc/passwd",
      "https://example.com/a.jpg",
    ];
    for (const u of ok) expect([u, isCaptureSource(u, fs)]).toEqual([u, true]);
    for (const u of bad) expect([u, isCaptureSource(u, fs)]).toEqual([u, false]);
  });

  it("purgeCaptureSources removes leftover picker and scanner files", async () => {
    const { store, files } = setup();
    files.set(CACHE + "ImagePicker/a.jpg", PLAIN_PAGE);
    files.set(DOC + "DOCUMENT_SCAN_2_20261105_101010.jpg", PLAIN_PAGE);
    files.set(DOC + "pages/x.enc", PLAIN_PAGE);
    await store.purgeCaptureSources();
    expect(files.has(CACHE + "ImagePicker/a.jpg")).toBe(false);
    expect(files.has(DOC + "DOCUMENT_SCAN_2_20261105_101010.jpg")).toBe(false);
    expect(files.has(DOC + "pages/x.enc")).toBe(true);
  });

  it("purgeCaptureSources also clears the Android ML Kit scanner cache dir", async () => {
    const { store, files } = setup();
    files.set(CACHE + "mlkit_docscan_ui_client/scan1.jpg", PLAIN_PAGE);
    files.set(CACHE + "mlkit_docscan_ui_client/sub/scan2.jpg", PLAIN_PAGE);
    files.set(CACHE + "other/keep.bin", PLAIN_PAGE);
    await store.purgeCaptureSources();
    expect([...files.keys()].filter((k) => k.includes("mlkit_docscan_ui_client"))).toEqual([]);
    expect(files.has(CACHE + "other/keep.bin")).toBe(true);
  });

  it("cleanupOrphanPages deletes files with no page row", async () => {
    const { store, files } = setup();
    const a = await store.savePage(CACHE + "picked.jpg");
    const b = await store.savePage(CACHE + "picked.jpg");
    const removed = await store.cleanupOrphanPages([a.imagePath, a.thumbPath]);
    expect(removed).toBe(2);
    const left = [...files.keys()].filter((k) => k.startsWith(DOC + "pages/"));
    expect(left.sort()).toEqual([DOC + a.imagePath, DOC + a.thumbPath].sort());
    expect(left).not.toContain(DOC + b.imagePath);
  });

  it("deleteFiles ignores missing files", async () => {
    const { store, files } = setup();
    const r = await store.savePage(CACHE + "picked.jpg");
    await expect(store.deleteFiles([r.imagePath, "pages/nope.enc"])).resolves.toBeUndefined();
    expect(files.has(DOC + r.imagePath)).toBe(false);
    expect(files.has(DOC + r.thumbPath)).toBe(true);
  });

  it("deleteFiles validates all paths before deleting any", async () => {
    const { store, files } = setup();
    const r = await store.savePage(CACHE + "picked.jpg");
    await expect(store.deleteFiles([r.imagePath, "../bad"])).rejects.toThrow();
    expect(files.has(DOC + r.imagePath)).toBe(true);
  });

  it("savePage cleans encrypted and plaintext files when the second encrypted write fails", async () => {
    const { fs, files } = memFs();
    files.set(CACHE + "picked.jpg", new Uint8Array([1]));
    let n = 0;
    const manipulate: Manipulate = async () => {
      const uri = `${CACHE}ImageManipulator/m${n++}.jpg`;
      files.set(uri, PLAIN_PAGE);
      return { uri, width: 1, height: 1 };
    };
    let writes = 0;
    const failing: FileOps = {
      ...fs,
      write: async (u, b) => {
        if (u.startsWith(DOC) && ++writes === 2) throw new Error("disk full");
        return fs.write(u, b);
      },
    };
    const store = createImageStore({ key: new Uint8Array(randomBytes(32)), fs: failing, manipulate });
    await expect(store.savePage(CACHE + "picked.jpg")).rejects.toThrow("disk full");
    expect([...files.keys()].filter((k) => k !== CACHE + "picked.jpg")).toEqual([]);
  });

  it("savePage removes partial files when a step fails", async () => {
    const { fs, files } = memFs();
    files.set(CACHE + "picked.jpg", new Uint8Array([1]));
    let calls = 0;
    const manipulate: Manipulate = async (_s, o) => {
      if (++calls === 2) throw new Error("boom");
      const uri = `${CACHE}m${calls}.jpg`;
      files.set(uri, PLAIN_PAGE);
      return { uri, width: 1, height: 1 };
    };
    const store = createImageStore({ key: new Uint8Array(randomBytes(32)), fs, manipulate });
    await expect(store.savePage(CACHE + "picked.jpg")).rejects.toThrow("boom");
    expect([...files.keys()].filter((k) => k.startsWith(DOC))).toEqual([]);
  });
});

describe("readPlain", () => {
  it("returns original bytes, writes nothing", async () => {
    const { store, files } = setup();
    const r = await store.savePage(CACHE + "picked.jpg");
    const before = new Set(files.keys());
    const bytes = await store.readPlain(r.thumbPath);
    expect(Array.from(bytes)).toEqual(Array.from(PLAIN_THUMB));
    expect(new Set(files.keys())).toEqual(before);
  });

  it("rejects an invalid path", async () => {
    const { store } = setup();
    await expect(store.readPlain("../x.enc")).rejects.toThrow(/Invalid page path/);
  });
});
