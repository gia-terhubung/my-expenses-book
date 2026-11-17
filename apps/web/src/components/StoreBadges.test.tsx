import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoreBadges } from "./StoreBadges";

describe("StoreBadges", () => {
  it("shows no badge and one text line before launch", () => {
    const { container } = render(<StoreBadges links={{ appStore: null, googlePlay: null }} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("Coming soon to the App Store and Google Play.")).toBeInTheDocument();
  });

  it("shows the official badge as a link for a store with a URL, and says the other is coming", () => {
    render(<StoreBadges links={{ appStore: "https://apps.apple.com/app/id1", googlePlay: null }} />);
    const link = screen.getByRole("link", { name: "Download on the App Store" });
    expect(link).toHaveAttribute("href", "https://apps.apple.com/app/id1");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Download on the App Store" })).toHaveAttribute("src", "/badges/app-store.svg");
    expect(screen.queryByRole("img", { name: "Get it on Google Play" })).toBeNull();
    expect(screen.getByText("Coming soon to Google Play.")).toBeInTheDocument();
  });

  it("shows both badges and no text line once both stores are live", () => {
    render(<StoreBadges links={{ appStore: "https://apps.apple.com/app/id1", googlePlay: "https://play.google.com/store/apps/details?id=x" }} />);
    expect(screen.getByRole("list", { name: "Get the app" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get it on Google Play" })).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=x",
    );
    expect(screen.queryByText(/Coming soon/)).toBeNull();
  });
});
