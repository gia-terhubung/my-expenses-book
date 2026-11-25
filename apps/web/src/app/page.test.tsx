import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { audiences, devices, features, hero, privacyPromise, story, tipJar } from "@/content/landing";
import HomePage from "./page";

describe("landing page", () => {
  it("has one h1 and the section headings in order", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(hero.title);
    const h2 = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual([story.title, devices.title, privacyPromise.title, features.title, audiences.title, tipJar.title]);
  });

  it("tells the store story in store order", () => {
    render(<HomePage />);
    const h3 = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(h3.slice(0, 5)).toEqual([
      "Know this month at a glance.",
      "Every receipt, readable.",
      "See where it goes.",
      "Trips and projects, any currency.",
      "Find any receipt in seconds.",
    ]);
  });

  it("shows the Duo folded and unfolded", () => {
    render(<HomePage />);
    expect(screen.getByText("Folded")).toBeInTheDocument();
    expect(screen.getByText("Unfolded")).toBeInTheDocument();
    expect(screen.getAllByRole("img").map((i) => i.getAttribute("width"))).toEqual(expect.arrayContaining(["560", "900"]));
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
    for (const item of [...features.items, ...audiences.items]) expect(screen.getAllByText(item.name).length).toBeGreaterThan(0);
  });
});
