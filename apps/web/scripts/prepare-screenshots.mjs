// Turns the English store captures (store/screenshots/raw/<device>/en/<scene>.png) into
// public/screenshots/<id>.webp, quality 82, at the web size of each device.
// A missing source or a source of the wrong size fails the run.
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const RAW = "../../store/screenshots/raw";

// Source size of each device capture, and the web size written (same aspect ratio).
const DEVICES = {
  iphone: { src: [1320, 2868], out: [780, 1695] },
  "duo-outer": { src: [1398, 2034], out: [560, 815] },
  "duo-inner": { src: [2007, 2853], out: [900, 1279] },
};

const SHOTS = [
  ["review", "iphone", "01-review"],
  ["home", "iphone", "02-home"],
  ["zoom", "iphone", "03-zoom"],
  ["stats", "iphone", "04-stats"],
  ["trip", "iphone", "05-trip"],
  ["search", "iphone", "06-search"],
  ["duo-outer-home", "duo-outer", "02-home"],
  ["duo-inner-home", "duo-inner", "02-home"],
];

await mkdir("public/screenshots", { recursive: true });

let failed = false;
for (const [id, device, scene] of SHOTS) {
  const src = `${RAW}/${device}/en/${scene}.png`;
  if (!existsSync(src)) {
    console.error(`${id}: missing ${src}`);
    failed = true;
    continue;
  }
  const { src: [sw, sh], out: [ow, oh] } = DEVICES[device];
  const { width, height } = await sharp(src).metadata();
  if (width !== sw || height !== sh) {
    console.error(`${src}: expected ${sw}x${sh}, got ${width}x${height}`);
    failed = true;
    continue;
  }
  await sharp(src).resize(ow, oh).webp({ quality: 82 }).toFile(`public/screenshots/${id}.webp`);
  console.log(`${id}: wrote public/screenshots/${id}.webp (${ow}x${oh})`);
}
process.exit(failed ? 1 : 0);
