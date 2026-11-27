import { act, render } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { initI18n } from "@/i18n";

import TabsLayout from "@/app/(tabs)/_layout";

// iOS (jest-expo's default platform): Apple's NativeTabs. Record what the layout hands it.
const mockTabs: { props?: Record<string, unknown>; triggers: string[] } = { triggers: [] };
jest.mock("expo-router/native-tabs", () => {
  const Trigger = ({ name, children }: { name: string; children?: ReactNode }) => {
    mockTabs.triggers.push(name);
    return <>{children}</>;
  };
  Trigger.Icon = () => null;
  Trigger.Label = () => null;
  const NativeTabs = ({ children, ...props }: { children?: ReactNode }) => {
    mockTabs.props = props;
    return <>{children}</>;
  };
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});
// The add flow needs native capture modules; only its context matters here.
jest.mock("@/capture/AddReceiptProvider", () => ({
  AddReceiptProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockTabs.props = undefined;
  mockTabs.triggers = [];
});

describe("tabs layout (iOS)", () => {
  it("uses NativeTabs with the tab bar placement (not a sidebar)", async () => {
    await render(<TabsLayout />);
    expect(mockTabs.props?.preferredPlacement).toBe("tabBar");
  });

  it("has the 4 tabs in order", async () => {
    await render(<TabsLayout />);
    expect(mockTabs.triggers.slice(0, 4)).toEqual(["(receipts)", "(search)", "(folders)", "(settings)"]);
  });

  it("mounts the tab bar hidden, then shows it (Duo cold-launch layout workaround)", async () => {
    jest.useFakeTimers();
    await render(<TabsLayout />);
    expect(mockTabs.props?.hidden).toBe(true);
    await act(async () => jest.advanceTimersByTime(500));
    expect(mockTabs.props?.hidden).toBe(false);
    jest.useRealTimers();
  });
});
