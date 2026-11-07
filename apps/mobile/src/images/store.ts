import { decryptBytes, encryptBytes } from "./crypto";
import { newId } from "@/db/ids";

/** Thin file layer (real one: expoFs.ts). URIs are absolute; dirs end with "/". */
export interface FileOps {
  documentDir: string;
  cacheDir: string;
  read(uri: string): Promise<Uint8Array>;
  /** Creates parent directories as needed; overwrites. */
  write(uri: string, bytes: Uint8Array): Promise<void>;
  /** No-op when the file is missing. */
  remove(uri: string): Promise<void>;
  /** File names directly under dir; [] when dir is missing. */
  list(dirUri: string): Promise<string[]>;
  /** Recursive; no-op when missing. */
  removeDir(dirUri: string): Promise<void>;
}

/** Resizes so the long edge is at most maxEdge (never upscales); outputs a JPEG in cache. */
export type Manipulate = (
  srcUri: string,
  opts: { maxEdge: number; quality: number },
) => Promise<{ uri: string; width: number; height: number }>;

export interface SavedPage {
  imagePath: string;
  thumbPath: string;
  width: number;
  height: number;
  normalizedUri: string;
}

export interface ImageStore {
  savePage(srcUri: string): Promise<SavedPage>;
  openForView(path: string): Promise<string>;
  deleteFiles(paths: string[]): Promise<void>;
  /** Deletes the decrypted view copies (cache/view/) of these pages now; missing copies are fine. */
  closeViews(paths: string[]): Promise<void>;
  /** `keepCaptureWork`: a capture is running (capture lease held), so only the view dir goes. */
  purgeDecryptedCache(opts?: { keepCaptureWork?: boolean }): Promise<void>;
  cleanupOrphanPages(knownPaths: string[]): Promise<number>;
  /** Deletes one plaintext capture file when `isCaptureSource` allows it; other URIs are ignored. */
  discardPlaintext(uri: string): Promise<void>;
  /** See the exported `isCaptureSource`, bound to this store's directories. */
  isCaptureSource(uri: string): boolean;
  /** Launch sweep of picker/scanner outputs a killed capture left behind. */
  purgeCaptureSources(): Promise<void>;
}

export const PAGE_MAX_EDGE = 1600;
export const PAGE_QUALITY = 0.8;
export const THUMB_MAX_EDGE = 320;
const THUMB_QUALITY = 0.7;

const PAGES = "pages/";
const VIEW = "view/";
// Store-owned plaintext staging (normalized page JPEG handed to OCR); purged with the view dir.
const WORK = "work/";
// expo-image-manipulator writes its outputs here; swept so a kill never leaves plaintext behind.
const MANIPULATOR_DIR = "ImageManipulator/";
// expo-image-picker copies picked assets here.
const PICKER_DIR = "ImagePicker/";
// react-native-document-scanner-plugin (iOS) writes plaintext scans straight into the document dir.
const SCANNER_FILE = /^DOCUMENT_SCAN_[0-9]+_[0-9_]+\.jpg$/;
// Android ML Kit document scanner output dir under the app cache (unverified on device: Task 12).
const MLKIT_SCANNER_DIR = "mlkit_docscan_ui_client/";
// Cache subdirs whose files capture may read and delete.
const CAPTURE_CACHE_DIRS = [PICKER_DIR, WORK, MLKIT_SCANNER_DIR];

/** `file://` form with iOS `/private/var` folded to `/var` (both name the same container). */
function normalizeFileUri(uri: string): string {
  const u = uri.startsWith("/") ? `file://${uri}` : uri;
  return u.replace(/^file:\/\/\/private\/var\//, "file:///var/");
}

/**
 * True only for a capture source the app itself produced: a file directly or deeper inside
 * cache/ImagePicker/, cache/work/ or the Android scanner cache dir, or an iOS scanner output
 * (`Documents/DOCUMENT_SCAN_*.jpg`). Anything with `%` (encoded tricks) or `.`/`..` segments is
 * rejected, as are other schemes (content://, https://) and every other path.
 */
export function isCaptureSource(uri: string, dirs: { cacheDir: string; documentDir: string }): boolean {
  if (uri.includes("%") || uri.includes("\\")) return false;
  const u = normalizeFileUri(uri);
  if (!u.startsWith("file:///")) return false;
  if (u.slice("file://".length).split("/").some((seg) => seg === "." || seg === "..")) return false;
  const cache = normalizeFileUri(dirs.cacheDir);
  const doc = normalizeFileUri(dirs.documentDir);
  for (const sub of CAPTURE_CACHE_DIRS) {
    const prefix = cache + sub;
    if (u.startsWith(prefix) && u.length > prefix.length && !u.endsWith("/")) return true;
  }
  return u.startsWith(doc) && SCANNER_FILE.test(u.slice(doc.length));
}
// Paths stored in the DB are relative to the document dir (the iOS container path changes).
const PAGE_PATH = /^pages\/[A-Za-z0-9-]+\.enc$/;

function assertPagePath(path: string): void {
  if (!PAGE_PATH.test(path)) throw new Error(`Invalid page path: ${path}`);
}

export function createImageStore(deps: {
  key: Uint8Array;
  fs: FileOps;
  manipulate: Manipulate;
}): ImageStore {
  const { key, fs, manipulate } = deps;
  const docUri = (rel: string) => fs.documentDir + rel;
  const viewDir = fs.cacheDir + VIEW;
  const workDir = fs.cacheDir + WORK;

  const writeEncrypted = async (rel: string, plain: Uint8Array) =>
    fs.write(docUri(rel), encryptBytes(key, plain));
  const removeQuietly = (uri: string) => fs.remove(uri).catch(() => undefined);
  const viewUri = (path: string) => `${viewDir}${path.slice(PAGES.length, -".enc".length)}.jpg`;

  return {
    async savePage(srcUri) {
      const written: string[] = [];
      const plaintext: string[] = [];
      try {
        const page = await manipulate(srcUri, { maxEdge: PAGE_MAX_EDGE, quality: PAGE_QUALITY });
        plaintext.push(page.uri);
        // Move the output out of the manipulator's own cache dir into the store-owned work dir.
        const normalizedUri = `${workDir}${newId()}.jpg`;
        plaintext.push(normalizedUri);
        const pageBytes = await fs.read(page.uri);
        await fs.write(normalizedUri, pageBytes);
        await removeQuietly(page.uri);
        const thumb = await manipulate(normalizedUri, { maxEdge: THUMB_MAX_EDGE, quality: THUMB_QUALITY });
        plaintext.push(thumb.uri);
        const imagePath = `${PAGES}${newId()}.enc`;
        const thumbPath = `${PAGES}${newId()}.enc`;
        written.push(docUri(imagePath), docUri(thumbPath));
        await writeEncrypted(imagePath, pageBytes);
        await writeEncrypted(thumbPath, await fs.read(thumb.uri));
        await removeQuietly(thumb.uri);
        return { imagePath, thumbPath, width: page.width, height: page.height, normalizedUri };
      } catch (e) {
        // No half-saved page, and no plaintext left behind on failure.
        await Promise.all(written.map(removeQuietly));
        await Promise.all(plaintext.map(removeQuietly));
        throw e;
      }
    },

    async openForView(path) {
      assertPagePath(path);
      const plain = decryptBytes(key, await fs.read(docUri(path)));
      const out = viewUri(path);
      await fs.write(out, plain);
      return out;
    },

    async closeViews(paths) {
      paths.forEach(assertPagePath);
      for (const p of paths) await removeQuietly(viewUri(p));
    },

    async deleteFiles(paths) {
      paths.forEach(assertPagePath); // validate all before deleting any
      for (const p of paths) await fs.remove(docUri(p));
    },

    async purgeDecryptedCache(opts) {
      if (opts?.keepCaptureWork) {
        await fs.removeDir(viewDir);
        return;
      }
      await Promise.all([
        fs.removeDir(viewDir),
        fs.removeDir(workDir),
        fs.removeDir(fs.cacheDir + MANIPULATOR_DIR),
      ]);
    },

    async discardPlaintext(uri) {
      if (isCaptureSource(uri, fs)) await fs.remove(normalizeFileUri(uri));
    },

    isCaptureSource: (uri) => isCaptureSource(uri, fs),

    async purgeCaptureSources() {
      await fs.removeDir(fs.cacheDir + PICKER_DIR);
      // Android scanner output left by a kill mid-capture or a scan whose /capture never mounted.
      await fs.removeDir(fs.cacheDir + MLKIT_SCANNER_DIR);
      for (const name of await fs.list(fs.documentDir)) {
        if (SCANNER_FILE.test(name)) await fs.remove(fs.documentDir + name);
      }
    },

    async cleanupOrphanPages(knownPaths) {
      const known = new Set(knownPaths);
      let removed = 0;
      for (const name of await fs.list(docUri(PAGES))) {
        const rel = PAGES + name;
        if (known.has(rel) || !PAGE_PATH.test(rel)) continue;
        await fs.remove(docUri(rel));
        removed++;
      }
      return removed;
    },
  };
}
