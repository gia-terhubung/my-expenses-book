import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInline } from "./renderInline";

const html = (text: string) => render(<p>{renderInline(text)}</p>).container.querySelector("p")!.innerHTML;

describe("renderInline", () => {
  it("returns plain text unchanged", () => {
    expect(html("No marks here.")).toBe("No marks here.");
  });
  it("renders bold at the start and code in the middle", () => {
    expect(html("**Tips.** Rates come from `cdn.jsdelivr.net` only.")).toBe(
      "<strong>Tips.</strong> Rates come from <code>cdn.jsdelivr.net</code> only.",
    );
  });
  it("renders a mailto link at the end", () => {
    expect(html("Questions: [halo@terhubung.app](mailto:halo@terhubung.app)")).toBe(
      'Questions: <a href="mailto:halo@terhubung.app">halo@terhubung.app</a>',
    );
  });
  it("renders an external link with rel and an internal link without", () => {
    expect(html("See [the disclosure](https://developers.google.com/ml-kit/android-data-disclosure).")).toBe(
      'See <a href="https://developers.google.com/ml-kit/android-data-disclosure" rel="noopener noreferrer">the disclosure</a>.',
    );
    expect(html("Our [privacy policy](/privacy) explains.")).toContain('<a href="/privacy">privacy policy</a>');
  });
  it("leaves an unclosed mark as text", () => {
    expect(html("2 ** 3 is 8")).toBe("2 ** 3 is 8");
  });
});
