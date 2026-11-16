// Rasterises docs/design/logo/meb-long-page*.svg into the icon slots wired in app.config.ts.
// No dependency is added to the app. Install the rasteriser anywhere outside the repo:
//   npm i --prefix /tmp/meb-resvg @resvg/resvg-js
//   RESVG_DIR=/tmp/meb-resvg node scripts/build-icons.mjs
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
const solid = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1">${bg.replace(/width="1024" height="1024"/, 'width="1" height="1"')}</svg>`;
// Splash image is 228x213: same art on a wider viewBox so it stays centred.
const splash = art.replace(/viewBox="[^"]*" width="1024" height="1024"/, 'viewBox="-36 0 1096 1024"');

mkdirSync(iconDir, { recursive: true });
const out = {
  [join(images, "icon.png")]: png(color, 1024),
  [join(images, "android-icon-foreground.png")]: png(art, 512),
  [join(images, "android-icon-background.png")]: png(solid, 512),
  [join(images, "android-icon-monochrome.png")]: png(mono.replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="#FFFFFF"'), 432),
  [join(images, "splash-icon.png")]: png(splash, 228),
};
for (const [p, buf] of Object.entries(out)) writeFileSync(p, buf);
writeFileSync(join(iconDir, "meb-long-page.svg"), art);
console.log("wrote", Object.keys(out).length, "pngs + expo.icon layer");
