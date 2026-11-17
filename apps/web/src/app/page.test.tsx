import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { audiences, features, hero, howItWorks, privacyPromise, tipJar } from "@/content/landing";
import HomePage from "./page";

describe("landing page", () => {
  it("has one h1 and the six section headings in order", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(hero.title);
    const h2 = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual([howItWorks.title, privacyPromise.title, features.title, audiences.title, tipJar.title]);
  });

  it("names the three network uses next to the privacy promise", () => {
    render(<HomePage />);
    for (const item of privacyPromise.network) expect(screen.getByText(item.name)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: privacyPromise.linkLabel })).toHaveAttribute("href", "/privacy");
  });

  it("says that tips unlock nothing", () => {
    render(<HomePage />);
    expect(screen.getByText(tipJar.note)).toBeInTheDocument();
  });

  it("shows every feature and audience", () => {
    render(<HomePage />);
    // getAllByText: a feature name can also appear on a screenshot placeholder ("Statistics").
    for (const item of [...features.items, ...audiences.items]) expect(screen.getAllByText(item.name).length).toBeGreaterThan(0);
  });
});
