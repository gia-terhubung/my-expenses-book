import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { initI18n } from "@/i18n";

import { GuideShell } from "./GuideShell";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeAll(() => initI18n("en"));

const shell = (mode: "split" | "column" | "short", controlFixed: boolean) => (
  <GuideShell
    mode={mode}
    dots={{ n: 4, total: 5 }}
    title="When does your month start?"
    explain={<Text>explain</Text>}
    control={<Text>grid</Text>}
    controlFixed={controlFixed}
    footer={<Text>footer</Text>}
  />
);
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

describe("GuideShell", () => {
  it("column + fixed control: explanation and control stack directly; spare room goes above the buttons", async () => {
    await render(shell("column", true));
    // The explanation is only as tall as its text (and shrinks to scroll when space runs out)...
    expect(flat("guide-explain").flexGrow).toBe(0);
    expect(flat("guide-explain").flexShrink).toBe(1);
    expect(flat("guide-explain").maxHeight).toBeUndefined();
    // ...the control pane is never squeezed, and its spacer pushes the buttons to the bottom.
    expect(flat("guide-control").flexShrink).toBe(0);
    expect(flat("guide-control").flexGrow).toBe(1);
    expect(flat("guide-footer-spacer").flexGrow).toBe(1);
  });

  it("column + scrolling control (a list): the explanation is capped and the list fills the rest", async () => {
    await render(shell("column", false));
    expect(flat("guide-control").flexGrow).toBe(1);
    expect(flat("guide-explain").maxHeight).toBe("60%");
  });

  it("short windows keep the 40% cap even for a fixed control, and the control scrolls so the buttons stay on screen", async () => {
    await render(shell("short", true));
    expect(flat("guide-explain").maxHeight).toBe("40%");
    expect(flat("guide-control-scroll").flex).toBe(1);
  });

  it("a fixed control stays in the same scroll view in every mode (rotation never remounts it)", async () => {
    const { rerender } = await render(shell("column", true));
    const before = screen.getByTestId("guide-control-scroll");
    expect(flat("guide-control-scroll").flexGrow).toBe(0);
    await rerender(shell("short", true));
    expect(screen.getByTestId("guide-control-scroll")).toBe(before);
  });
});
