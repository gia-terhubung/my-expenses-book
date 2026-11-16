import { existsSync } from "node:fs";
import { resolve } from "node:path";

import config from "../app.config";

const root = resolve(__dirname, "..");
const onDisk = (p: string | undefined) => !!p && existsSync(resolve(root, p));

describe("app icons", () => {
  it("references icon files that exist", () => {
    const a = config.android?.adaptiveIcon;
    expect(onDisk(config.icon)).toBe(true);
    expect(onDisk(config.ios?.icon as string)).toBe(true);
    expect(onDisk(a?.foregroundImage)).toBe(true);
    expect(onDisk(a?.backgroundImage)).toBe(true);
    expect(onDisk(a?.monochromeImage)).toBe(true);
    const splash = config.plugins?.find((p) => Array.isArray(p) && p[0] === "expo-splash-screen") as [string, { image: string }];
    expect(onDisk(splash[1].image)).toBe(true);
  });

  it("iOS icon bundle layers exist", () => {
    const icon = require("../assets/expo.icon/icon.json");
    for (const g of icon.groups) for (const l of g.layers) expect(existsSync(resolve(root, "assets/expo.icon/Assets", l["image-name"]))).toBe(true);
  });

  it("uses the yellow ground", () => {
    expect(config.android?.adaptiveIcon?.backgroundColor).toBe("#FFD84A");
    const splash = config.plugins?.find((p) => Array.isArray(p) && p[0] === "expo-splash-screen") as [string, { backgroundColor: string }];
    expect(splash[1].backgroundColor).toBe("#FFD84A");
  });
});
