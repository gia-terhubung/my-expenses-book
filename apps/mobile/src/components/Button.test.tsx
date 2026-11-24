import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { tokens } from "@/theme/tokens";

import { Button } from "./Button";

const light = tokens.light.colors;

function flat(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(typeof s === "function" ? s({ pressed: false }) : (s as object));
}

describe("Button", () => {
  it("renders accessibilityRole button with label as name", async () => {
    await render(<Button label="Save" onPress={() => {}} />);
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });

  it("does not call onPress when disabled", async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("does not call onPress when busy and announces busy", async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} busy />);
    const button = screen.getByRole("button", { name: "Save" });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it("busy keeps the label in the tree (opacity 0) so width is stable", async () => {
    await render(<Button label="Save" onPress={() => {}} busy />);
    const label = screen.getByText("Save");
    expect(StyleSheet.flatten(label.props.style).opacity).toBe(0);
  });

  it("danger secondary uses tonalDanger fill", async () => {
    await render(<Button label="Delete" onPress={() => {}} tone="danger" />);
    const style = flat(screen.getByRole("button", { name: "Delete" }));
    expect(style.backgroundColor).toBe(light.tonalDanger);
    expect(StyleSheet.flatten(screen.getByText("Delete").props.style).color).toBe(light.danger);
  });

  it("primary uses primary fill with shadow in light", async () => {
    await render(<Button label="Go" onPress={() => {}} variant="primary" />);
    const style = flat(screen.getByRole("button", { name: "Go" }));
    expect(style.backgroundColor).toBe(light.primary);
    expect(style.boxShadow).toBe("0 6px 14px -8px rgba(31,92,76,0.7)");
  });

  it("disabled uses tonal fill with no opacity change", async () => {
    await render(<Button label="Go" onPress={() => {}} variant="primary" disabled />);
    const style = flat(screen.getByRole("button", { name: "Go" }));
    expect(style.backgroundColor).toBe(light.tonal);
    expect(style.opacity).toBeUndefined();
  });

  it("quiet is an outline button: no fill, a 1 pt outline, centred label, no underline", async () => {
    await render(<Button label="Skip" onPress={() => {}} variant="quiet" />);
    const box = flat(screen.getByRole("button", { name: "Skip" }));
    expect(box).toMatchObject({ backgroundColor: "transparent", borderWidth: 1, borderColor: light.outline, alignItems: "center" });
    expect(box.paddingHorizontal).toBe(tokens.light.spacing.lg);
    const label = StyleSheet.flatten(screen.getByText("Skip").props.style);
    expect(label.textDecorationLine).toBeUndefined();
    expect(label.color).toBe(light.primary);
  });

  it("quiet muted and danger tones colour both the outline and the label", async () => {
    await render(
      <>
        <Button label="Later" onPress={() => {}} variant="quiet" tone="muted" />
        <Button label="Remove" onPress={() => {}} variant="quiet" tone="danger" />
      </>,
    );
    expect(flat(screen.getByRole("button", { name: "Later" })).borderColor).toBe(light.border);
    expect(StyleSheet.flatten(screen.getByText("Later").props.style).color).toBe(light.textMuted);
    expect(flat(screen.getByRole("button", { name: "Remove" })).borderColor).toBe(light.outlineDanger);
    expect(StyleSheet.flatten(screen.getByText("Remove").props.style).color).toBe(light.danger);
  });

  it("disabled quiet keeps the outline in the plain border colour", async () => {
    await render(<Button label="Skip" onPress={() => {}} variant="quiet" disabled />);
    expect(flat(screen.getByRole("button", { name: "Skip" })).borderColor).toBe(light.border);
  });

  it("highlight uses the yellow fill with ink text, and stays yellow when pressed", async () => {
    await render(<Button label="Tip" variant="highlight" onPress={() => {}} />);
    const btn = () => screen.getByRole("button", { name: "Tip" });
    expect(flat(btn()).backgroundColor).toBe(light.highlight);
    expect(flat(screen.getByText("Tip")).color).toBe(light.onHighlight);
    await fireEvent(btn(), "responderGrant", { nativeEvent: { touches: [] }, persist() {} });
    expect(flat(btn()).backgroundColor).toBe(light.highlight);
    expect(flat(btn()).opacity).toBeLessThan(1);
  });

  it("disabled highlight falls back to the tonal fill", async () => {
    await render(<Button label="Tip" variant="highlight" disabled onPress={() => {}} />);
    expect(flat(screen.getByRole("button", { name: "Tip" })).backgroundColor).toBe(light.tonal);
    expect(flat(screen.getByText("Tip")).color).toBe(light.textMuted);
  });

  it("shrinkLabel keeps the label on one line and shrinks it to fit", async () => {
    await render(<Button label="Rp 150.000" shrinkLabel onPress={() => {}} />);
    const label = screen.getByText("Rp 150.000");
    expect(label.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    expect(flat(label).alignSelf).toBe("stretch");
  });

  it("forwards press-in and press-out", async () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    await render(<Button label="Save" onPress={() => {}} onPressIn={onPressIn} onPressOut={onPressOut} />);
    await fireEvent(screen.getByRole("button", { name: "Save" }), "pressIn");
    await fireEvent(screen.getByRole("button", { name: "Save" }), "pressOut");
    expect([onPressIn.mock.calls.length, onPressOut.mock.calls.length]).toEqual([1, 1]);
  });

  describe("pressed state", () => {
    async function pressed(props: Partial<React.ComponentProps<typeof Button>>) {
      await render(<Button label="X" onPress={() => {}} {...props} />);
      const button = screen.getByRole("button", { name: "X" });
      await fireEvent(button, "responderGrant", { nativeEvent: { touches: [] }, persist() {} });
      return flat(screen.getByRole("button", { name: "X" }));
    }

    it("primary uses primaryPressed and translateY 1", async () => {
      const style = await pressed({ variant: "primary" });
      expect(style.backgroundColor).toBe(light.primaryPressed);
      expect(style.transform).toEqual([{ translateY: 1 }]);
    });

    it("secondary uses tonalPressed", async () => {
      expect((await pressed({})).backgroundColor).toBe(light.tonalPressed);
    });

    it("danger secondary dims to 0.85", async () => {
      expect((await pressed({ tone: "danger" })).opacity).toBe(0.85);
    });

    it("quiet fills with the tonal tint when pressed", async () => {
      const style = await pressed({ variant: "quiet" });
      expect(style.backgroundColor).toBe(light.tonalPressed);
      expect(style.opacity).toBeUndefined();
    });
  });
});
