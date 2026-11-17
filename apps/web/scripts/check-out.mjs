// Checks on the built static site (`out/`) and on the source colours.
// Run after `npm run build`. Add --launch for the extra launch-only checks.
// No dependencies; HTML is scanned with regular expressions.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = "out";
const SELF_HOST = "meb.terhubung.app";
const launch = process.argv.includes("--launch");
const failures = [];
const fail = (file, reason) => {
  const line = `FAIL ${file}: ${reason}`;
  if (!failures.includes(line)) failures.push(line);
};

function walk(dir, test) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...walk(full, test));
    else if (test(full)) found.push(full);
  }
  return found;
}

const read = (f) => readFileSync(f, "utf8");
const htmlFiles = walk(OUT, (f) => f.endsWith(".html"));

// 3. Required pages.
for (const f of ["index.html", "privacy.html", "terms.html", "404.html", "robots.txt", "sitemap.xml"]) {
  if (!existsSync(join(OUT, f))) fail(OUT, `required file ${f} is missing`);
}

/** Resolves a site path to a file in out/, or null. */
function resolveOut(path) {
  const clean = decodeURIComponent(path.split("#")[0].split("?")[0]);
  const candidates = clean === "/" ? ["index.html"] : [clean, clean + ".html", join(clean, "index.html")];
  for (const c of candidates) {
    const full = join(OUT, c);
    if (existsSync(full) && statSync(full).isFile()) return full;
  }
  return null;
}

const isThirdParty = (url) => {
  const m = url.match(/^(?:https?:)?\/\/([^/?#:]+)/i);
  return m !== null && m[1].toLowerCase() !== SELF_HOST;
};

for (const file of htmlFiles) {
  const html = read(file);

  // 1. Internal links resolve (a and link elements).
  for (const m of html.matchAll(/<(?:a|link)\b[^>]*?\shref="([^"]*)"/g)) {
    const href = m[1];
    if (!href.startsWith("/") && !href.startsWith("#")) continue;
    if (href.startsWith("//")) continue;
    const [path, id] = href.split("#");
    const target = path === "" ? file : resolveOut(path);
    if (!target) {
      fail(file, `${href} does not resolve`);
      continue;
    }
    if (id && target.endsWith(".html") && !read(target).includes(`id="${id}"`)) {
      fail(file, `${href}: no element with id="${id}" in ${relative(".", target)}`);
    }
  }

  // 2. No third-party resource.
  for (const m of html.matchAll(/\s(?:src|srcset)="([^"]*)"/g)) {
    for (const part of m[1].split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (isThirdParty(url)) fail(file, `third-party resource ${url}`);
    }
  }
  for (const m of html.matchAll(/<link\b[^>]*>/g)) {
    const tag = m[0];
    if (/\brel="canonical"/.test(tag) || /\brel="alternate"/.test(tag)) continue;
    const href = tag.match(/\shref="([^"]*)"/)?.[1];
    if (href && isThirdParty(href)) fail(file, `third-party resource ${href}`);
  }
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
    if (isThirdParty(m[1])) fail(file, `third-party resource ${m[1]}`);
  }

  // Screenshots and store badges that the page points at must exist in out/.
  for (const m of html.matchAll(/\/(?:screenshots|badges)\/[\w.-]+\.(?:webp|svg|png)/g)) {
    if (!existsSync(join(OUT, m[0]))) fail(file, `${m[0]} is missing`);
  }
}

for (const css of walk(join(OUT, "_next"), (f) => f.endsWith(".css"))) {
  const text = read(css);
  for (const m of text.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)/g)) {
    if (isThirdParty(m[1])) fail(css, `third-party @import ${m[1]}`);
  }
  for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
    if (isThirdParty(m[1])) fail(css, `third-party resource ${m[1]}`);
  }
}

// 4. No raw colour outside the token files.
const sources = [
  ...walk("src", (f) => f.endsWith(".module.css")),
  ...walk(join("src", "components"), (f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx")),
  ...walk(join("src", "app"), (f) => /[\\/]page\.tsx$/.test(f)),
];
const RAW_COLOUR = /(?<!href=["'])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?)\(/g;
for (const file of new Set(sources)) {
  for (const m of read(file).matchAll(RAW_COLOUR)) fail(file, `raw colour ${m[0]}`);
}

// 5. Launch only.
if (launch) {
  for (const file of htmlFiles) {
    for (const m of read(file).matchAll(/data-placeholder="([^"]*)"/g)) fail(file, `screenshot placeholder ${m[1]} still present`);
  }
  const index = join(OUT, "index.html");
  if (existsSync(index) && /Coming soon/.test(read(index))) fail(index, '"Coming soon" text still present');
  const site = read(join("src", "config", "site.ts"));
  for (const key of ["appStore", "googlePlay"]) {
    if (new RegExp(`${key}:\\s*null`).test(site.split("STORE_LINKS")[1] ?? "")) {
      fail("src/config/site.ts", `STORE_LINKS.${key} is still null`);
    }
  }
  for (const name of ["COMPANY_ADDRESS", "COMPANY_CITY"]) {
    for (const file of htmlFiles) {
      if (read(file).includes(name)) fail(file, `placeholder ${name} still present`);
    }
    if (new RegExp(`=\\s*"${name}"`).test(site)) fail("src/config/site.ts", `${name} is still a placeholder`);
  }
  for (const f of ["app-store.svg", "google-play.png"]) {
    if (!existsSync(join(OUT, "badges", f))) fail(OUT, `badge file badges/${f} is missing`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`OK ${htmlFiles.length} pages checked`);
