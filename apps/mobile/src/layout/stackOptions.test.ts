import { tokens } from "@/theme/tokens";

import { rootStackOptions } from "./stackOptions";

const t = (key: string) => (key === "common.back" ? "Kembali" : key);

describe("rootStackOptions", () => {
  it("hides headers by default and gives the back button a real label (not the route group name)", () => {
    expect(rootStackOptions(t, tokens.light.colors)).toMatchObject({ headerShown: false, headerBackTitle: "Kembali" });
  });

  it.each(["light", "dark"] as const)("%s: native headers follow the theme (Kotak tip, Error log, Backup, receipt)", (mode) => {
    const c = tokens[mode].colors;
    expect(rootStackOptions(t, c)).toMatchObject({
      headerStyle: { backgroundColor: c.background },
      headerTintColor: c.primary,
      headerTitleStyle: { color: c.text },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: c.background },
    });
  });
});
