// Writes src/app/apple-icon.png and src/app/opengraph-image.png from the logo.
// Run from apps/web: npm run brand-images. The PNGs are committed, so this runs once.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const logo = await readFile("public/logo/meb-long-page.svg");

await sharp(logo).resize(180, 180).png().toFile("src/app/apple-icon.png");

const mask = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="44" ry="44" fill="#fff"/></svg>');
const logoRounded = await sharp(logo)
  .resize(200, 200)
  .composite([{ input: mask, blend: "dest-in" }])
  .png()
  .toBuffer();

const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#1F5C4C"/>
  <text x="80" y="400" font-family="Helvetica, Arial, sans-serif" font-size="84" font-weight="800" fill="#FFFFFF">My Expenses Book</text>
  <rect x="80" y="432" width="88" height="10" rx="5" ry="5" fill="#FFD84A"/>
  <text x="80" y="520" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#BFD9CF">Scan a receipt. Keep the record, not the paper.</text>
</svg>`);

const og = await sharp(text)
  .composite([{ input: logoRounded, left: 80, top: 96 }])
  .png()
  .toBuffer();
await writeFile("src/app/opengraph-image.png", og);
console.log("wrote src/app/apple-icon.png and src/app/opengraph-image.png");
