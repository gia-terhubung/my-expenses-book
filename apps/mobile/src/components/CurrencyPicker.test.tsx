import { fireEvent, render, screen } from "@testing-library/react-native";

import { initI18n } from "@/i18n";

import { CurrencyPicker, currencyLabel, currencyName } from "./CurrencyPicker";

// Intl.DisplayNames is typed read-only; tests swap it to simulate Hermes gaps.
const setDisplayNames = (v: unknown) =>
  Object.defineProperty(Intl, "DisplayNames", { value: v, configurable: true, writable: true });

beforeAll(() => initI18n("en"));

describe("currencyName", () => {
  it("uses Intl.DisplayNames when available", () => {
    expect(currencyName("en", "USD")).toMatch(/dollar/i);
  });
  it("falls back to the code when Intl.DisplayNames is missing", () => {
    const orig = Intl.DisplayNames;
    setDisplayNames(undefined);
    try {
      expect(currencyName("en", "USD")).toBe("USD");
    } finally {
      setDisplayNames(orig);
    }
  });
  it("falls back to the code when DisplayNames throws", () => {
    const orig = Intl.DisplayNames;
    setDisplayNames(function () {
      throw new RangeError("x");
    });
    try {
      expect(currencyName("en", "EUR")).toBe("EUR");
    } finally {
      setDisplayNames(orig);
    }
  });
});

describe("currencyLabel", () => {
  it("is code plus name when a name is known", () => {
    expect(currencyLabel("en", "USD")).toMatch(/^USD .*dollar/i);
  });
  it("is the code once when no name is known (Hermes without DisplayNames)", () => {
    const orig = Intl.DisplayNames;
    setDisplayNames(undefined);
    try {
      expect(currencyLabel("id", "IDR")).toBe("IDR");
    } finally {
      setDisplayNames(orig);
    }
  });
});

describe("CurrencyPicker", () => {
  it("filters by code or name and reports selection", async () => {
    const onChange = jest.fn();
    await render(<CurrencyPicker lang="en" value="USD" onChange={onChange} />);
    await fireEvent.changeText(screen.getByPlaceholderText("Search"), "yen");
    await fireEvent.press(screen.getByRole("radio", { name: /^JPY/ }));
    expect(onChange).toHaveBeenCalledWith("JPY");
  });
  it("works with code only when names are unavailable", async () => {
    const orig = Intl.DisplayNames;
    setDisplayNames(undefined);
    try {
      await render(<CurrencyPicker lang="en" value="USD" onChange={jest.fn()} />);
      await fireEvent.changeText(screen.getByPlaceholderText("Search"), "chf");
      expect(screen.getByRole("radio", { name: "CHF" })).toBeTruthy();
    } finally {
      setDisplayNames(orig);
    }
  });
});
