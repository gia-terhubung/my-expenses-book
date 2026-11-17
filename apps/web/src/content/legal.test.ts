import { describe, expect, it } from "vitest";
import type { LegalDoc } from "./legal-types";
import { privacy } from "./privacy";
import { terms } from "./terms";

const text = (doc: LegalDoc) =>
  [...doc.intro, ...doc.sections.flatMap((s) => [{ type: "p" as const, text: s.heading }, ...s.blocks])]
    .map((b) => (b.type === "p" ? b.text : b.items.join("\n")))
    .join("\n");

describe("privacy policy facts", () => {
  const t = text(privacy);
  it.each([
    "stored only on your device",
    "The database and the images are encrypted",
    "`cdn.jsdelivr.net`",
    "only a currency code and a date",
    "the app asks the App Store or Google Play for prices",
    "**Android only: Google ML Kit.**",
    "a per-installation identifier",
    "It never sends your receipt images or text",
    "Apple's on-device Vision framework and sends nothing",
    "sets no cookies and uses no analytics",
    "Vercel processes standard request logs",
    "halo@terhubung.app",
    "PT Terhubung Lebih Lagi",
  ])("states: %s", (fact) => expect(t).toContain(fact));
});

describe("terms of use facts", () => {
  const t = text(terms);
  it.each([
    "does not give financial, accounting, tax or legal advice",
    "Exchange rates are indicative",
    "Making backups, and keeping them safe, is your responsibility",
    "Tips are voluntary",
    "A tip unlocks nothing",
    "Refunds are handled by Apple or Google",
    "between you and us only, not Apple",
    "third-party beneficiaries",
    "\"as is\"",
    "As far as the law allows",
    "laws of the Republic of Indonesia",
    "halo@terhubung.app",
  ])("states: %s", (fact) => expect(t).toContain(fact));
});

describe.each([["privacy", privacy], ["terms", terms]] as const)("%s structure", (_name, doc) => {
  it("has unique kebab-case section ids", () => {
    const ids = doc.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });
  it("has an ISO effective date", () => expect(doc.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/));
});
