#!/usr/bin/env node
// Guards committed parser fixtures against leaking tokens from the owner's real
// OCR dumps. The dumps (spikes/ocr-dumps/) are gitignored and only exist on the
// owner's machine; when they are absent (CI, other clones) the check is skipped.
//
// Collected from every dump file:
//   - every digit run of 6+ digits (account, card, phone, NPWP, reference numbers),
//     after joining digits split by single separators ("0812-3456", "1320 0234",
//     "001.337.994") so dashed/spaced/dotted numbers are caught too
//   - every ALL-CAPS word sequence that follows a name/account label
//     (same line, or the next line when the label ends the line)
// Exits 1 listing each token found in any file under src/parsing/__fixtures__/.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dumpsDir = join(root, 'spikes', 'ocr-dumps');
const fixturesDir = join(root, 'src', 'parsing', '__fixtures__');

const LABELS = [
  'Penerima',
  'Pengirim',
  'From',
  'Name',
  'Nama',
  'Beneficiary Name',
  'Rekening Sumber',
  'Rekening Tujuan',
  'Ditransfer ke',
];
// Label must start the line (so "Bank Penerima  BRI" or "Product Name" don't
// match), be case-insensitive (ATM slips print "NAMA :"), and be followed by
// a separator or end of line.
const LABEL_RE = new RegExp(
  `^\\s*(?:${LABELS.map((l) => l.replace(/ /g, '\\s+')).join('|')})\\s*[:.]?(?:\\s+|$)`,
  'i',
);
// Case-sensitive: words of capitals (plus digits/punctuation inside a word),
// separated by single spaces. Double spaces separate OCR columns.
const CAPS_RE = /^[A-Z][A-Z0-9.&'-]*(?: [A-Z][A-Z0-9.&'-]*)*/;
const MIN_CAPS_LEN = 4;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Dates, years and grouped amounts are not PII and recur by design (fixtures
// keep the true totals/dates), so they are masked before digits are joined;
// otherwise "16 Oct 2026 08:36" or "Rp 1.000.000" would join into false hits.
const MASKS = [
  /\b\d{1,2}[-./]\d{1,2}[-./]\d{2,4}\b/g, // 29.09.26, 05-11-2026, 04/11/26
  /\b\d{4}-\d{2}-\d{2}\b/g, // 2026-11-05 (expected.json)
  /\b20[2-3]\d\b/g, // standalone year
  /(?<!\d|\d[.,])[1-9]\d{0,2}(?:[.,]\d{3})+(?!\d|[.,]\d)/g, // Rp1.000.000, 27,665 (no leading 0: NPWP/phones stay)
];

// Mask the above, then join digits split by one space or a dash/dot with
// optional spaces ("0812-3456", "777 - 126 - 2116", "001.337.994"). Applied to
// dumps and fixtures alike, so a number re-formatted with other separators
// still matches.
function joinDigits(text) {
  let t = text;
  for (const re of MASKS) t = t.replace(re, '#');
  return t.replace(/(\d)(?: ?[.-] ?| )(?=\d)/g, '$1');
}

function collectTokens(text) {
  const tokens = new Set();
  for (const m of text.matchAll(/\d{6,}/g)) tokens.add(m[0]);
  for (const m of joinDigits(text).matchAll(/\d{6,}/g)) tokens.add(m[0]);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = LABEL_RE.exec(line);
    if (!m) return;
    let rest = line.slice(m[0].length).trim();
    if (rest === '' && i + 1 < lines.length) rest = lines[i + 1].trim();
    const caps = CAPS_RE.exec(rest);
    if (caps && caps[0].trim().length >= MIN_CAPS_LEN) tokens.add(caps[0].trim());
  });
  return tokens;
}

if (!existsSync(dumpsDir)) {
  console.log('skip: no dumps');
  process.exit(0);
}

const tokens = new Set();
for (const file of walk(dumpsDir)) {
  for (const t of collectTokens(readFileSync(file, 'utf8'))) tokens.add(t);
}

const leaks = [];
for (const file of walk(fixturesDir)) {
  const text = readFileSync(file, 'utf8');
  const joined = joinDigits(text);
  for (const t of tokens) {
    if (text.includes(t) || joined.includes(t)) leaks.push(`${relative(root, file)}: ${t}`);
  }
}

if (leaks.length > 0) {
  console.error(`PII guard: ${leaks.length} dump token(s) found in fixtures:`);
  for (const l of leaks) console.error(`  ${l}`);
  process.exit(1);
}
console.log(`ok: ${tokens.size} dump tokens checked against fixtures, none found`);
