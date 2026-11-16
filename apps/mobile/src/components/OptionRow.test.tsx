import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, type ViewStyle } from "react-native";

import { tokens } from "@/theme/tokens";

import { OptionRow } from "./OptionRow";

const light = tokens.light.colors;

function flat(node: { props: { style?: unknown } }) {
  return StyleSheet.flatten(node.props.style as ViewStyle) as ViewStyle;
}

async function press(label: string) {
  await fireEvent(screen.getByRole("radio", { name: label }), "responderGrant", { nativeEvent: { touches: [] }, persist() {} });
  return flat(screen.getByRole("radio", { name: label }));
}

describe("OptionRow", () => {
  it("defaults to radio role", async () => {
    await render(<OptionRow label="A" selected={false} onPress={() => {}} />);
    expect(screen.getByRole("radio", { name: "A" })).toBeTruthy();
  });

  it("role checkbox reports checked state", async () => {
    await render(<OptionRow role="checkbox" label="A" selected onPress={() => {}} />);
    const row = screen.getByRole("checkbox", { name: "A" });
    expect(row.props.accessibilityState).toEqual({ checked: true });
  });

  it("selected row uses primary fill, primaryPressed when pressed", async () => {
    await render(<OptionRow label="A" selected onPress={() => {}} />);
    const row = screen.getByRole("radio", { name: "A" });
    expect(flat(row).backgroundColor).toBe(light.primary);
    expect((await press("A")).backgroundColor).toBe(light.primaryPressed);
  });

  it("unselected row presses to surfacePressed", async () => {
    await render(<OptionRow label="A" selected={false} onPress={() => {}} />);
    const row = screen.getByRole("radio", { name: "A" });
    expect(flat(row).backgroundColor).toBe(light.surface);
    expect((await press("A")).backgroundColor).toBe(light.surfacePressed);
  });
});
