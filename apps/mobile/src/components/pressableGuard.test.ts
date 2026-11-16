import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n) ? [p] : [];
  });
}

/** Text of each `<Pressable ...>` opening tag: up to the first `>` outside braces/strings. */
function openingTags(src: string): { line: number; tag: string }[] {
  const out: { line: number; tag: string }[] = [];
  const re = /<Pressable\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 0;
    let quote: string | null = null;
    let i = m.index + m[0].length;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== "\\") quote = null;
      } else if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && src[i - 1] !== "=") break;
    }
    out.push({ line: src.slice(0, m.index).split("\n").length, tag: src.slice(m.index, i + 1) });
  }
  return out;
}

/** file (relative to src) → reason. Keep empty unless a Pressable is truly not interactive for AT. */
const ALLOW: Record<string, string> = {};

describe("Pressable guard", () => {
  it("every Pressable declares an accessibilityRole", () => {
    const root = join(__dirname, "..");
    let seen = 0;
    const offenders = files(root).flatMap((f) => {
      const rel = relative(root, f);
      if (ALLOW[rel]) return [];
      const tags = openingTags(readFileSync(f, "utf8"));
      seen += tags.length;
      return tags
        .filter((t) => !/\baccessibilityRole\b|\brole=/.test(t.tag))
        .map((t) => `${rel}:${t.line}`);
    });
    expect(seen).toBeGreaterThan(17); // the scan really found the app's Pressables
    expect(offenders).toEqual([]);
  });

  it("no product file imports Button from react-native", () => {
    const root = join(__dirname, "..");
    const offenders = files(root)
      .map((f) => relative(root, f))
      .filter((rel) => !rel.startsWith(`dev${sep}`))
      .filter((rel) => {
        const src = readFileSync(join(root, rel), "utf8");
        return [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']react-native["']/g)].some((m) =>
          /\bButton\b/.test(m[1]),
        );
      });
    expect(offenders).toEqual([]);
  });
});
