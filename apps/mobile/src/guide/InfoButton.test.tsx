import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { initI18n } from "@/i18n";

import { InfoButton } from "./InfoButton";
import { InfoText } from "./InfoText";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function flat(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(typeof s === "function" ? s({ pressed: false }) : (s as object));
}

beforeAll(() => initI18n("en"));

describe("InfoButton", () => {
  it("has a 48dp target and an 'About Pay cycle' label", async () => {
    await render(<InfoButton topic="payCycle" />);
    const button = screen.getByRole("button", { name: "About Pay cycle" });
    expect(flat(button).width).toBe(48);
    expect(flat(button).height).toBe(48);
  });

  it("opens the sheet with title, summary, body and example", async () => {
    await render(<InfoButton topic="payCycle" example="Oct 25 – Nov 24" />);
    expect(screen.queryByText("Exports and search use calendar months.", { exact: false })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "About Pay cycle" }));
    expect(screen.getByRole("header", { name: "Pay cycle" })).toBeTruthy();
    expect(screen.getByText(/^Pick the day you get paid\./)).toBeTruthy();
    expect(screen.getByText("Used by Home and Statistics. Exports and search use calendar months.")).toBeTruthy();
    expect(screen.getByText("Oct 25 – Nov 24")).toBeTruthy();
  });

  it("Done closes the sheet", async () => {
    await render(<InfoButton topic="taxYear" />);
    await fireEvent.press(screen.getByRole("button", { name: "About Tax year" }));
    expect(screen.getByRole("header", { name: "Tax year" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("header", { name: "Tax year" })).toBeNull();
  });
});

describe("InfoText", () => {
  it("shows summary then each body paragraph", async () => {
    await render(<InfoText topic="payCycle" showSummary />);
    expect(screen.getByText(/^Pick the day you get paid\./)).toBeTruthy();
    expect(screen.getByText(/^Only days 1–28/)).toBeTruthy();
    expect(screen.getByText(/^Used by Home and Statistics/)).toBeTruthy();
  });

  it("can leave the summary out", async () => {
    await render(<InfoText topic="payCycle" />);
    expect(screen.queryByText(/^Pick the day you get paid\./)).toBeNull();
    expect(screen.getByText(/^Only days 1–28/)).toBeTruthy();
  });
});
