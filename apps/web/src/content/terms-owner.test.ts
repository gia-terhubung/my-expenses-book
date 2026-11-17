import { describe, expect, it } from "vitest";
import { COMPANY_ADDRESS, COMPANY_CITY } from "@/config/site";
import { terms } from "./terms";

const section = (id: string) => JSON.stringify(terms.sections.find((s) => s.id === id));

describe("terms: owner decisions", () => {
  it("sends disputes to the District Court of the registered domicile, with no arbitration", () => {
    const law = section("law");
    expect(law).toContain("District Court (Pengadilan Negeri)");
    expect(law).toContain(COMPANY_CITY);
    expect(JSON.stringify(terms)).not.toMatch(/BANI|arbitration/i);
  });
  it("caps liability 'to the extent permitted by applicable law'", () => {
    expect(section("liability")).toContain("To the extent permitted by applicable law, our total liability");
    expect(section("liability")).toContain("IDR 100,000");
  });
  it("gives the company address in the Apple section and in the contact section", () => {
    expect(section("apple")).toContain(COMPANY_ADDRESS);
    expect(section("contact")).toContain(COMPANY_ADDRESS);
  });
  it("keeps the placeholders visible until the owner fills them", () => {
    expect(COMPANY_ADDRESS).toBe("COMPANY_ADDRESS");
    expect(COMPANY_CITY).toBe("COMPANY_CITY");
  });
});
