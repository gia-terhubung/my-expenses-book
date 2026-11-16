import { render } from "@testing-library/react-native";

import { ThemedStatusBar } from "./ThemedStatusBar";

const mockStatusBar = jest.fn((_props: { style: string }) => null);
jest.mock("expo-status-bar", () => ({ StatusBar: (p: { style: string }) => mockStatusBar(p) }));
let mockScheme: "light" | "dark" = "light";
jest.mock("./ThemeProvider", () => ({ useTheme: () => ({ scheme: mockScheme }) }));

describe("ThemedStatusBar", () => {
  it("uses dark icons on the light theme (white icons vanish on a light background)", async () => {
    mockScheme = "light";
    await render(<ThemedStatusBar />);
    expect(mockStatusBar).toHaveBeenLastCalledWith({ style: "dark" });
  });
  it("uses light icons on the dark theme", async () => {
    mockScheme = "dark";
    await render(<ThemedStatusBar />);
    expect(mockStatusBar).toHaveBeenLastCalledWith({ style: "light" });
  });
});
