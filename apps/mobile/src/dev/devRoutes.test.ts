import { readFileSync } from "fs";
import { join } from "path";

const ROUTES: Record<string, string> = {
  "ai-spike": "AiSpike",
  "db-check": "DbCheck",
  "db-spike": "DbSpike",
  "dev/clock": "DevClock",
  "ocr-check": "OcrCheck",
};

describe("dev routes", () => {
  it.each(Object.entries(ROUTES))("%s requires its screen only under __DEV__", (route, screen) => {
    const src = readFileSync(join(__dirname, "..", "app", "(dev)", `${route}.tsx`), "utf8");
    expect(src).toMatch(new RegExp(`__DEV__ \\? require\\("@/dev/screens/${screen}"\\)`));
    // Any static @/ import would pull app code into the release bundle regardless of __DEV__.
    expect(src).not.toMatch(/from ["']@\//);
  });
});
