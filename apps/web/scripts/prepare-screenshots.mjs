// Turns screenshots-src/<id>.png (1320x2868) into public/screenshots/<id>.webp (780x1695, quality 82).
// Missing sources are reported and skipped. A source of the wrong size fails the run.
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const IDS = ["home-slip", "capture", "review", "receipt-detail", "statistics", "tip-jar"];
await mkdir("public/screenshots", { recursive: true });

let failed = false;
for (const id of IDS) {
  const src = `screenshots-src/${id}.png`;
  if (!existsSync(src)) {
    console.log(`${id}: missing`);
    continue;
  }
  const { width, height } = await sharp(src).metadata();
  if (width !== 1320 || height !== 2868) {
    console.error(`${id}.png: expected 1320x2868, got ${width}x${height}`);
    failed = true;
    continue;
  }
  await sharp(src).resize(780, 1695).webp({ quality: 82 }).toFile(`public/screenshots/${id}.webp`);
  console.log(`${id}: wrote public/screenshots/${id}.webp`);
}
process.exit(failed ? 1 : 0);
