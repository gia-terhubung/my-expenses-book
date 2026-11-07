import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { toMinor } from "@/money/money";

import { parseHeuristic } from "./heuristics";
import { splitReceipts } from "./heuristics/split";
import type { ParsedReceipt } from "./types";

type Segment = { total: string | null; date: string | null; refNo?: string };
type Expected = Segment & {
  currency: string;
  time?: string;
  merchant?: string;
  tax?: string;
  category?: string;
  split?: number;
  segments?: Segment[];
};

const DIR = join(__dirname, "__fixtures__");
const expected: Record<string, Expected> = JSON.parse(readFileSync(join(DIR, "expected.json"), "utf8"));
const hints = { homeCurrency: "IDR", today: new Date(2026, 10, 5) };
const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

function totalOk(p: ParsedReceipt, total: string | null, currency: string) {
  return total === null ? p.totalMinor === null : p.totalMinor === toMinor(total, currency);
}

type Row = {
  fixture: string;
  total: boolean;
  date: boolean;
  split: boolean;
  merchant: boolean | null;
  category: boolean | null;
  currency: boolean;
  got: string;
};

const rows: Row[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".txt"))
  .sort()
  .map((file) => {
    const exp = expected[file];
    if (!exp) throw new Error(`missing expected entry for ${file}`);
    const lines = readFileSync(join(DIR, file), "utf8").split("\n");
    const { segments } = splitReceipts(lines, hints);
    const parsed = segments.map((s) => parseHeuristic(s, hints));
    const wantSegs: Segment[] = exp.segments ?? [exp];
    const splitOk = segments.length === (exp.split ?? 1);
    const segOk = (i: number, key: "total" | "date") => {
      const p = parsed[i];
      const w = wantSegs[i];
      if (!p || !w) return false;
      return key === "total" ? totalOk(p, w.total, exp.currency) : p.purchasedDate === w.date;
    };
    const first = parsed[0]!;
    return {
      fixture: file.replace(/\.txt$/, ""),
      total: splitOk && wantSegs.every((_, i) => segOk(i, "total")),
      date: splitOk && wantSegs.every((_, i) => segOk(i, "date")),
      split: splitOk,
      merchant: exp.merchant === undefined ? null : norm(first.merchant) === norm(exp.merchant),
      category: exp.category === undefined ? null : first.categoryId === exp.category,
      currency: first.currency === exp.currency,
      got: parsed
        .map((p) => `${p.totalMinor ?? "-"} ${p.currency} ${p.purchasedDate ?? "-"} | ${p.merchant ?? "-"} | ${p.categoryId ?? "-"}`)
        .join(" // "),
    };
  });

const mark = (v: boolean | null) => (v === null ? "  " : v ? "ok" : "XX");

describe("heuristic parser accuracy", () => {
  it("total AND date correct on >= 85% of fixtures", () => {
    const correct = rows.filter((r) => r.total && r.date).length;
    const scored = (k: "merchant" | "category") => {
      const s = rows.filter((r) => r[k] !== null);
      return `${s.filter((r) => r[k]).length}/${s.length}`;
    };
    const table = [
      "fixture                       tot date split merch cat cur  parsed",
      ...rows.map(
        (r) =>
          `${r.fixture.padEnd(29)} ${mark(r.total)}  ${mark(r.date)}   ${mark(r.split)}    ${mark(r.merchant)}   ${mark(r.category)}  ${mark(r.currency)}  ${r.got}`,
      ),
      `total+date: ${correct}/${rows.length}  total: ${rows.filter((r) => r.total).length}/${rows.length}` +
        `  date: ${rows.filter((r) => r.date).length}/${rows.length}  merchant: ${scored("merchant")}` +
        `  category: ${scored("category")}  currency: ${rows.filter((r) => r.currency).length}/${rows.length}`,
    ].join("\n");
    process.stdout.write(`\n${table}\n`);
    expect(rows).toHaveLength(50);
    expect(correct / rows.length).toBeGreaterThanOrEqual(0.85);
  });
});
