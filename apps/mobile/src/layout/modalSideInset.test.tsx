import { readFileSync } from "fs";
import { join } from "path";

import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { ModalSideInset } from "./ModalSideInset";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 12, right: 84 }),
}));
jest.mock("@/theme/ThemeProvider", () => ({ useTheme: () => ({ colors: { background: "#F2F5F1" } }) }));

describe("ModalSideInset", () => {
  it("pads modal content by the root side insets with the page background", async () => {
    await render(
      <ModalSideInset>
        <Text>body</Text>
      </ModalSideInset>,
    );
    const flat = StyleSheet.flatten(screen.getByTestId("modal-side-inset").props.style);
    expect(flat).toMatchObject({ flex: 1, paddingLeft: 12, paddingRight: 84, backgroundColor: "#F2F5F1" });
    expect(flat.paddingTop).toBeUndefined();
  });

  it("wraps the (modals) stack", () => {
    const src = readFileSync(join(__dirname, "..", "app", "(modals)", "_layout.tsx"), "utf8");
    expect(src).toMatch(/<ModalSideInset>\s*<Stack /);
  });
});
