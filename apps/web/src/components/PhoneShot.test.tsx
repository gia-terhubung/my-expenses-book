import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SHOTS, type ShotId } from "@/content/screenshots";
import { PhoneShot } from "./PhoneShot";

describe("PhoneShot", () => {
  it("draws the image with its alt text, size and device", () => {
    const { container } = render(<PhoneShot id="review" />);
    const img = screen.getByRole("img", { name: SHOTS.review.alt });
    expect(decodeURIComponent(img.getAttribute("src")!)).toContain("/screenshots/review.webp");
    expect(img).toHaveAttribute("width", "780");
    expect(img).toHaveAttribute("height", "1695");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(container.querySelector("[data-device]")).toHaveAttribute("data-device", "iphone");
  });

  it("uses the Duo inner size and frame", () => {
    const { container } = render(<PhoneShot id="duo-inner-home" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "900");
    expect(img).toHaveAttribute("height", "1279");
    expect(container.querySelector("[data-device]")).toHaveAttribute("data-device", "duo-inner");
  });

  it("loads eagerly when asked", () => {
    render(<PhoneShot id="review" eager />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
  });

  it("matches every webp file to its size in the table", async () => {
    for (const id of Object.keys(SHOTS) as ShotId[]) {
      const meta = await sharp(readFileSync(`public/screenshots/${id}.webp`)).metadata();
      expect([id, meta.width, meta.height]).toEqual([id, SHOTS[id].width, SHOTS[id].height]);
    }
  });
});
