import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { tokens } from "@/theme/tokens";

import { Card } from "./Card";

const light = tokens.light.colors;

function flat(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(typeof s === "function" ? s({ pressed: false }) : (s as object));
}

describe("Card", () => {
  it("renders a View without onPress", async () => {
    await render(
      <Card testID="card">
        <Text>Hi</Text>
      </Card>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Hi")).toBeTruthy();
    const style = flat(screen.getByTestId("card"));
    expect(style.backgroundColor).toBe(light.surface);
    expect(style.borderColor).toBe(light.border);
  });

  it("renders a button with onPress", async () => {
    await render(
      <Card onPress={() => {}} accessibilityLabel="Open">
        <Text>Hi</Text>
      </Card>,
    );
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
  });

  it("selected uses tonal fill", async () => {
    await render(
      <Card testID="card" selected>
        <Text>Hi</Text>
      </Card>,
    );
    expect(flat(screen.getByTestId("card")).backgroundColor).toBe(light.tonal);
  });
});
