import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { StatusBarInset } from "./StatusBarInset";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => ({ colors: { background: "#fff" } }),
}));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n)
        ? [p]
        : [];
  });
}

describe("StatusBarInset", () => {
  it("pads its fixed wrapper by the status-bar inset", async () => {
    await render(
      <StatusBarInset>
        <Text>body</Text>
      </StatusBarInset>,
    );
    const flat = Object.assign(
      {},
      ...[screen.getByTestId("status-bar-inset").props.style].flat(),
    );
    expect(flat).toMatchObject({ flex: 1, paddingTop: 40 });
  });

  it("uses the given color", async () => {
    await render(
      <StatusBarInset color="#1F5C4C">
        <Text>body</Text>
      </StatusBarInset>,
    );
    const flat = Object.assign(
      {},
      ...[screen.getByTestId("status-bar-inset").props.style].flat(),
    );
    expect(flat).toMatchObject({ paddingTop: 40, backgroundColor: "#1F5C4C" });
  });

  it("defaults to the page background", async () => {
    await render(
      <StatusBarInset>
        <Text>body</Text>
      </StatusBarInset>,
    );
    const flat = Object.assign(
      {},
      ...[screen.getByTestId("status-bar-inset").props.style].flat(),
    );
    expect(flat).toMatchObject({ backgroundColor: "#fff" });
  });

  // Scroll content that carries the top inset slides under the transparent Android status bar.
  it("is the only place screens take the top inset (fixed, non-scrolling chrome excepted)", () => {
    const allowed = new Set([
      "src/layout/StatusBarInset.tsx",
      "src/layout/useSheetTopInset.ts", // page-sheet modal inset, not screen content
      "src/layout/SideRail.tsx", // fixed rail, not scrolled
      "src/layout/EmptyState.tsx", // fixed placeholder body
      "src/review/PageViewer.tsx", // absolutely positioned close button
    ]);
    const root = join(__dirname, "..");
    const offenders = files(root)
      .map((p) => relative(join(root, ".."), p))
      .filter((p) => !allowed.has(p))
      .filter((p) =>
        /insets\.top/.test(readFileSync(join(root, "..", p), "utf8")),
      );
    expect(offenders).toEqual([]);
  });
});
