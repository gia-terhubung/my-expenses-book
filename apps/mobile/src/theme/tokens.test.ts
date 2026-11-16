import { tokens } from "./tokens";

it("light and dark define the same keys", () => {
  const light = Object.keys(tokens.light.colors).sort();
  const dark = Object.keys(tokens.dark.colors).sort();
  expect(dark).toEqual(light);
});

it("elevation strings are non-empty in both schemes", () => {
  for (const scheme of ["light", "dark"] as const) {
    expect(tokens[scheme].elevation.raised.length).toBeGreaterThan(0);
    expect(tokens[scheme].elevation.sheet.length).toBeGreaterThan(0);
  }
});
