import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { EmptyState } from "./EmptyState";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 30, bottom: 0, left: 0, right: 0 }),
}));

const paddingTop = () =>
  StyleSheet.flatten(screen.getByTestId("empty-state").props.style)
    .paddingTop as number;

describe("EmptyState", () => {
  it("adds the top inset by default; topInset={false} leaves it to the host", async () => {
    const view = await render(<EmptyState title="T" />);
    const withInset = paddingTop();
    await view.rerender(<EmptyState title="T" topInset={false} />);
    expect(withInset - paddingTop()).toBe(30);
  });
});
