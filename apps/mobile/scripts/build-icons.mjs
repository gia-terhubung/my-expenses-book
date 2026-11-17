// Rasterises docs/design/logo/meb-long-page*.svg into the icon slots wired in app.config.ts.
// No dependency is added to the app. Install the rasteriser anywhere outside the repo:
//   npm i --prefix /tmp/meb-resvg @resvg/resvg-js
//   RESVG_DIR=/tmp/meb-resvg node scripts/build-icons.mjs
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const logo = resolve(here, "../../../docs/design/logo");
const images = resolve(here, "../assets/images");
const iconDir = resolve(here, "../assets/expo.icon/Assets");
const { Resvg } = createRequire(join(resolve(process.env.RESVG_DIR ?? "."), "x.js"))("@resvg/resvg-js");

const YELLOW = "#FFD84A";
const color = readFileSync(join(logo, "meb-long-page.svg"), "utf8");
const mono = readFileSync(join(logo, "meb-long-page-mono.svg"), "utf8");
const bg = `<rect width="1024" height="1024" fill="${YELLOW}"/>`;
if (!color.includes(bg)) throw new Error("background rect not found in source svg");
const art = color.replace(bg, ""); // transparent foreground

const png = (svg, width) => new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
// The store icon must be opaque: drop the alpha channel and write an 8-bit RGB PNG.
const rgbPng = (svg, width) => {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render();
  const { width: w, height: h, pixels } = img;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1); // filter byte 0 (none) leads each row
    for (let x = 0; x < w; x++) {
      const a = pixels[(y * w + x) * 4 + 3];
      if (a !== 255) throw new Error(`icon.png pixel ${x},${y} is not opaque`);
      pixels.copy(raw, row + 1 + x * 3, (y * w + x) * 4, (y * w + x) * 4 + 3);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit, colour type 2 (RGB), no interlace
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
};
const solid = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1">${bg.replace(/width="1024" height="1024"/, 'width="1" height="1"')}</svg>`;
// Splash image is 228x213: same art on a wider viewBox so it stays centred.
const splash = art.replace(/viewBox="[^"]*" width="1024" height="1024"/, 'viewBox="-36 0 1096 1024"');

mkdirSync(iconDir, { recursive: true });
const out = {
  [join(images, "icon.png")]: rgbPng(color, 1024),
  [join(images, "android-icon-foreground.png")]: png(art, 512),
  [join(images, "android-icon-background.png")]: png(solid, 512),
  [join(images, "android-icon-monochrome.png")]: png(mono.replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="#FFFFFF"'), 432),
  [join(images, "splash-icon.png")]: png(splash, 228),
};
for (const [p, buf] of Object.entries(out)) writeFileSync(p, buf);
writeFileSync(join(iconDir, "meb-long-page.svg"), art);
console.log("wrote", Object.keys(out).length, "pngs + expo.icon layer");
