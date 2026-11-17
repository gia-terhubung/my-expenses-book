import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoreBadges } from "./StoreBadges";

describe("StoreBadges", () => {
  it("shows two disabled badges and no link before launch", () => {
    render(<StoreBadges links={{ appStore: null, googlePlay: null }} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("App Store").closest("[data-store]")).toHaveAttribute("data-state", "soon");
    expect(screen.getByText("Google Play").closest("[data-store]")).toHaveAttribute("data-state", "soon");
    expect(screen.getAllByText("Coming soon")).toHaveLength(2);
  });

  it("links a store once its URL is set, and leaves the other disabled", () => {
    render(<StoreBadges links={{ appStore: "https://apps.apple.com/app/id1", googlePlay: null }} />);
    const link = screen.getByRole("link", { name: "Download on App Store" });
    expect(link).toHaveAttribute("href", "https://apps.apple.com/app/id1");
    expect(screen.getAllByText("Coming soon")).toHaveLength(1);
    expect(screen.getByText("Google Play").closest("[data-store]")).toHaveAttribute("data-state", "soon");
  });

  it("is a labelled list", () => {
    render(<StoreBadges links={{ appStore: null, googlePlay: null }} />);
    expect(screen.getByRole("list", { name: "Get the app" })).toBeInTheDocument();
  });
});
