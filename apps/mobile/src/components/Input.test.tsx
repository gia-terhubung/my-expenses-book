import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, type TextStyle } from "react-native";

import { tokens } from "@/theme/tokens";

import { Input } from "./Input";

const light = tokens.light;
const flat = (n: { props: { style?: unknown } }) => StyleSheet.flatten(n.props.style as TextStyle) as TextStyle;

describe("Input", () => {
  it("rests with a 1.5 border and control radius", async () => {
    await render(<Input accessibilityLabel="x" />);
    expect(flat(screen.getByLabelText("x"))).toMatchObject({ borderWidth: 1.5, borderColor: light.colors.border, borderRadius: light.radius.control });
  });
  it("focus shows the primary border and tonal ring", async () => {
    await render(<Input accessibilityLabel="x" />);
    await fireEvent(screen.getByLabelText("x"), "focus");
    expect(flat(screen.getByLabelText("x"))).toMatchObject({ borderColor: light.colors.primary, boxShadow: `0 0 0 4px ${light.colors.tonal}` });
  });
  it("keeps a flag colour when focused", async () => {
    await render(<Input accessibilityLabel="x" flagColor="#c00" />);
    await fireEvent(screen.getByLabelText("x"), "focus");
    const s = flat(screen.getByLabelText("x"));
    expect(s.borderColor).toBe("#c00");
    expect(s.borderWidth).toBe(2);
    expect(s.boxShadow).toBeUndefined();
  });
});
