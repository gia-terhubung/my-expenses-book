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

  it("quiet is underlined, muted tone is not", async () => {
    await render(
      <>
        <Button label="Skip" onPress={() => {}} variant="quiet" />
        <Button label="Later" onPress={() => {}} variant="quiet" tone="muted" />
      </>,
    );
    expect(StyleSheet.flatten(screen.getByText("Skip").props.style).textDecorationLine).toBe("underline");
    const later = StyleSheet.flatten(screen.getByText("Later").props.style);
    expect(later.textDecorationLine).toBeUndefined();
    expect(later.color).toBe(light.textMuted);
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

    it("quiet uses pressedOpacity", async () => {
      expect((await pressed({ variant: "quiet" })).opacity).toBe(tokens.light.state.pressedOpacity);
    });
  });
});
