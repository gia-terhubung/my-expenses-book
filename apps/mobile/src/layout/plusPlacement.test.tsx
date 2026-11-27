import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";

import { AddReceiptContext, type AddReceipt } from "@/capture/addReceiptContext";
import { initI18n } from "@/i18n";

import { NativeTabsContext } from "./navContext";
import { SHORT_COLUMN_HEIGHT, useColumnPlusMenu } from "./PlusMenu";
import { TabPlus, TabStackPlus } from "./TabPlus";

/**
 * Where the + goes on iOS (spec "Final decisions", variant B), by window and route, never by model:
 * a Duo side column puts it last in the header, no column floats it bottom-right on the outer edge.
 */
jest.mock("expo-router", () => jest.requireActual("../../test/expoRouterStack").stackMock);

let mockEdge: "leading" | "trailing" | null = null;
jest.mock("expo-status-bar", () => ({ useVerticalBarEdgeIOS: () => mockEdge }));

let mockHeight = 874;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 402, height: mockHeight, scale: 3, fontScale: 1 }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

// Apple's menu (SwiftUI): the label is the round +, each choice a button.
jest.mock("@expo/ui/swift-ui", () => {
  const { Pressable, Text: RNText, View } = jest.requireActual("react-native");
  return {
    Host: ({ children }: { children: ReactNode }) => <View>{children}</View>,
    RNHostView: ({ children }: { children: ReactNode }) => <View>{children}</View>,
    Menu: ({ children, label }: { children: ReactNode; label: ReactNode }) => (
      <View testID="swiftui-menu">
        {label}
        {children}
      </View>
    ),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
        <RNText>{label}</RNText>
      </Pressable>
    ),
  };
});
jest.mock("@expo/ui/swift-ui/modifiers", () => ({ accessibilityLabel: () => ({}) }));

const add: AddReceipt = { open: jest.fn(), start: jest.fn(async () => {}) };

function Tabs({ children, flow = add }: { children: ReactNode; flow?: AddReceipt | null }) {
  return (
    <NativeTabsContext.Provider value>
      <AddReceiptContext.Provider value={flow}>{children}</AddReceiptContext.Provider>
    </NativeTabsContext.Provider>
  );
}

const headerPluses = () => screen.queryAllByLabelText("Add receipt").filter((n) => n.props.testID !== "floating-add");

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockEdge = null;
  mockHeight = 874;
  jest.clearAllMocks();
});

describe("+ placement (iOS native tabs)", () => {
  it("no column: floating + on every tab root, none in the header", async () => {
    await render(
      <Tabs>
        <TabStackPlus routeName="folders">
          <TabPlus />
        </TabStackPlus>
      </Tabs>,
    );
    expect(screen.getByTestId("floating-add")).toBeTruthy();
    expect(headerPluses()).toHaveLength(0);
  });

  it("column: Home floats, other pages put the + in the header", async () => {
    mockEdge = "trailing";
    const home = await render(
      <Tabs>
        <TabStackPlus routeName="index">
          <TabPlus home />
        </TabStackPlus>
      </Tabs>,
    );
    expect(screen.getByTestId("floating-add")).toBeTruthy();
    expect(headerPluses()).toHaveLength(0);
    await home.unmount();

    await render(
      <Tabs>
        <TabStackPlus routeName="folder/[id]">
          <TabPlus />
        </TabStackPlus>
      </Tabs>,
    );
    expect(screen.queryByTestId("floating-add")).toBeNull();
    expect(headerPluses()).toHaveLength(1);
  });

  it("short column: Home's + goes into the column", async () => {
    mockEdge = "trailing";
    mockHeight = SHORT_COLUMN_HEIGHT - 94; // folded Duo held sideways: 466 pt
    await render(
      <Tabs>
        <TabStackPlus routeName="index">
          <TabPlus home />
        </TabStackPlus>
      </Tabs>,
    );
    expect(screen.queryByTestId("floating-add")).toBeNull();
    expect(headerPluses()).toHaveLength(1);
  });

  it.each(["search", "search-filter", "sheet", "photo", "recurring/[id]"])(
    "no header + on %s",
    async (routeName) => {
      mockEdge = "trailing";
      await render(
        <Tabs>
          <TabStackPlus routeName={routeName}>
            <Text>page</Text>
          </TabStackPlus>
        </Tabs>,
      );
      expect(headerPluses()).toHaveLength(0);
    },
  );

  it("a page that claims the + (its own header buttons) gets exactly one, last", async () => {
    mockEdge = "trailing";
    function Page() {
      const { menu } = useColumnPlusMenu();
      return <>{menu}</>;
    }
    await render(
      <Tabs>
        <TabStackPlus routeName="folder/[id]">
          <Page />
        </TabStackPlus>
      </Tabs>,
    );
    expect(headerPluses()).toHaveLength(1);
  });

  it("floating + follows the bar edge (Split View, our app in the left half)", async () => {
    mockEdge = "leading";
    const left = await render(
      <Tabs>
        <TabPlus />
      </Tabs>,
    );
    // A "leading" bar edge means a side column exists, so only Home floats there.
    expect(screen.queryByTestId("floating-add")).toBeNull();
    await left.unmount();

    await render(
      <Tabs>
        <TabPlus home />
      </Tabs>,
    );
    const style = StyleSheet.flatten(screen.getByTestId("floating-add").props.style);
    expect(style.left).toBe(16);
    expect(style.right).toBeUndefined();
  });

  it("no column: the floating + sits on the right", async () => {
    await render(
      <Tabs>
        <TabPlus />
      </Tabs>,
    );
    const style = StyleSheet.flatten(screen.getByTestId("floating-add").props.style);
    expect(style.right).toBe(16);
    expect(style.left).toBeUndefined();
    expect(style.bottom).toBe(34 + 16);
  });

  it("the floating + opens Apple's menu: Scan / Import / Add manually, each starting its flow", async () => {
    await render(
      <Tabs>
        <TabPlus />
      </Tabs>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Scan receipt" }));
    expect(add.start).toHaveBeenLastCalledWith("scan");
    await fireEvent.press(screen.getByRole("button", { name: "Import from Photos" }));
    expect(add.start).toHaveBeenLastCalledWith("photos");
    await fireEvent.press(screen.getByRole("button", { name: "Add manually" }));
    expect(add.start).toHaveBeenLastCalledWith("manual");
  });

  it("useColumnPlusMenu outside the add flow (modals) returns no menu and does not throw", async () => {
    mockEdge = "trailing";
    const report = jest.fn();
    function Page() {
      report(useColumnPlusMenu());
      return null;
    }
    await render(
      <Tabs flow={null}>
        <Page />
      </Tabs>,
    );
    expect(report).toHaveBeenLastCalledWith({ menu: null, submenu: null });
  });

  it("off native tabs (Android, modals) there is no floating +", async () => {
    await render(
      <AddReceiptContext.Provider value={add}>
        <TabPlus home />
      </AddReceiptContext.Provider>,
    );
    expect(screen.queryByTestId("floating-add")).toBeNull();
  });
});
