/**
 * Test stand-in for expo-router's native `Stack` header API (`Stack.Screen`, `Stack.Toolbar` and its
 * items). Screens declare their header with these; under Jest they render as plain views so tests can
 * find and press header actions. Spread into a file's mock:
 *
 *   jest.mock("expo-router", () => ({ ...jest.requireActual("../../test/expoRouterStack").stackMock, router: … }));
 */
import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type ItemProps = {
  children?: ReactNode;
  accessibilityLabel?: string;
  onPress?: () => void;
  [key: string]: unknown;
};

const textOf = (children: ReactNode) =>
  typeof children === "string" || typeof children === "number" ? String(children) : undefined;

function Action({ children, accessibilityLabel, onPress }: ItemProps) {
  const label = accessibilityLabel ?? textOf(children);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {label ? <Text>{label}</Text> : children}
    </Pressable>
  );
}

function Menu({ children, accessibilityLabel, title }: ItemProps & { title?: string }) {
  return <View accessibilityLabel={accessibilityLabel ?? title}>{children}</View>;
}

// Like the native toolbar, only direct children count: a fragment's items are not shown.
function Toolbar({ children, placement = "bottom" }: { children?: ReactNode; placement?: string }) {
  const direct = Children.toArray(children).filter((c) => !(isValidElement(c) && c.type === Fragment));
  return <View testID={`toolbar-${placement}`}>{direct}</View>;
}
Toolbar.Button = Action;
Toolbar.Menu = Menu;
Toolbar.MenuAction = Action;
function Spacer() {
  return null;
}
function ToolbarView({ children }: { children?: ReactNode }) {
  return <View>{children}</View>;
}
Toolbar.Spacer = Spacer;
Toolbar.View = ToolbarView;

function Stack({ children }: { children?: ReactNode }) {
  return <View>{children}</View>;
}
function Screen(_: { options?: unknown; name?: string }) {
  return null;
}
Stack.Screen = Screen;
Stack.Toolbar = Toolbar;

export const stackMock = { Stack };
