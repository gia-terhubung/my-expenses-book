import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { privacy } from "@/content/privacy";
import { formatEffectiveDate, LegalDocument } from "./LegalDocument";

describe("LegalDocument", () => {
  it("formats the effective date", () => {
    expect(formatEffectiveDate("2026-11-17")).toBe("17 November 2026");
  });
  it("renders every section as an anchored h2, and no h1", () => {
    const { container } = render(<LegalDocument doc={privacy} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    const h2 = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual(privacy.sections.map((s) => s.heading));
    for (const s of privacy.sections) expect(container.querySelector(`section#${s.id}`)).not.toBeNull();
    expect(screen.getByText("Effective 17 November 2026")).toBeInTheDocument();
  });
  it("renders ordered and unordered lists", () => {
    const { container } = render(<LegalDocument doc={privacy} />);
    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
    expect(container.querySelectorAll("ul").length).toBeGreaterThanOrEqual(2);
  });
});
