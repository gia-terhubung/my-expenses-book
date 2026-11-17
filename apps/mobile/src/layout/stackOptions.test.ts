import { rootStackOptions } from "./stackOptions";

describe("rootStackOptions", () => {
  it("hides headers by default and gives the back button a real label (not the route group name)", () => {
    const t = (key: string) => (key === "common.back" ? "Kembali" : key);
    expect(rootStackOptions(t)).toEqual({ headerShown: false, headerBackTitle: "Kembali" });
  });
});
