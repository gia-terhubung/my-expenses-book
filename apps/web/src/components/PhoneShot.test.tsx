import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SHOTS } from "@/content/screenshots";
import { PhoneShot } from "./PhoneShot";

describe("PhoneShot", () => {
  it("draws a marked placeholder while the screenshot is not ready", () => {
    // Explicit shots table: the real one marks home-slip ready once its screenshot is committed.
    const shots = { ...SHOTS, "home-slip": { ...SHOTS["home-slip"], ready: false } };
    const { container } = render(<PhoneShot id="home-slip" shots={shots} />);
    const placeholder = screen.getByRole("img", { name: "Screenshot placeholder: Home" });
    expect(placeholder).toHaveAttribute("data-placeholder", "home-slip");
    expect(placeholder).toHaveTextContent("Screenshot placeholder");
    expect(placeholder).toHaveTextContent("home-slip.webp");
    expect(container.querySelector("img")).toBeNull();
  });

  it("draws the image with its alt text and size once ready", () => {
    const shots = { ...SHOTS, review: { ...SHOTS.review, ready: true } };
    const { container } = render(<PhoneShot id="review" shots={shots} />);
    const img = screen.getByRole("img", { name: SHOTS.review.alt });
    expect(decodeURIComponent(img.getAttribute("src")!)).toContain("/screenshots/review.webp");
    expect(img).toHaveAttribute("width", "780");
    expect(img).toHaveAttribute("height", "1695");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(container.querySelector("[data-placeholder]")).toBeNull();
  });

  it("loads eagerly when asked", () => {
    const shots = { ...SHOTS, "home-slip": { ...SHOTS["home-slip"], ready: true } };
    render(<PhoneShot id="home-slip" eager shots={shots} />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
  });
});
