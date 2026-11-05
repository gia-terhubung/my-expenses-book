import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("AppModal guard", () => {
  it("no file except AppModal.tsx imports Modal from react-native", () => {
    const re = /import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*["']react-native["']/;
    const offenders = files(join(__dirname, "..")).filter(
      (f) => !f.endsWith("AppModal.tsx") && !f.endsWith("appModalGuard.test.ts") && re.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
