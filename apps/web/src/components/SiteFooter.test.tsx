import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  it("links to the legal pages and the contact address", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms of use" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "halo@terhubung.app" })).toHaveAttribute("href", "mailto:halo@terhubung.app");
  });

  it("names the publisher and says the site has no cookies or analytics", () => {
    render(<SiteFooter />);
    expect(screen.getByText("Made by PT Terhubung Lebih Lagi, Indonesia.")).toBeInTheDocument();
    expect(screen.getByText("This website uses no cookies and no analytics.")).toBeInTheDocument();
  });
});
