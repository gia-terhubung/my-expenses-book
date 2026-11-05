import { randomBytes } from "node:crypto";

import { decryptBytes } from "./crypto";
import { createImageStore, type FileOps, type Manipulate } from "./store";

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
