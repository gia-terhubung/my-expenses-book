import { fireEvent, render, screen } from "@testing-library/react-native";

import { DateField } from "./DateField";
import { dateToLocalString } from "./dateString";

// jest-expo's ios preset resolves DateField.ios.tsx; the native module is mocked here.
let pick: ((d: Date) => void) | undefined;
jest.mock("@expo/ui/swift-ui", () => {
  const { Text: T } = require("react-native");
  return {
    DatePicker: (p: { selection?: Date; onDateChange?: (d: Date) => void; title?: string }) => {
      pick = p.onDateChange;
      return <T>{`picker:${p.selection ? p.selection.getFullYear() : "none"}`}</T>;
    },
  };
});
jest.mock("@expo/ui", () => {
  const { View } = require("react-native");
  return { Host: ({ children }: { children: React.ReactNode }) => <View>{children}</View> };
});

describe("DateField (platform file)", () => {
  it("renders label and error, and maps a picked Date to YYYY-MM-DD", async () => {
    const onChange = jest.fn();
    await render(<DateField label="Date" value="2026-11-07" onChange={onChange} error="Bad date" />);
    expect(screen.getByText("Date")).toBeTruthy();
    expect(screen.getByText("Bad date")).toBeTruthy();
    expect(screen.getByText("picker:2026")).toBeTruthy();
    pick?.(new Date(2026, 2, 29, 9, 30));
    expect(onChange).toHaveBeenCalledWith("2026-03-29");
  });

  it("empty value: shows placeholder, no picker; press writes today", async () => {
    const onChange = jest.fn();
    await render(<DateField label="Date" value="" onChange={onChange} placeholder="YYYY-MM-DD" />);
    expect(screen.getByText("YYYY-MM-DD")).toBeTruthy();
    expect(screen.queryByText(/^picker:/)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Date" }));
    expect(onChange).toHaveBeenCalledWith(dateToLocalString(new Date()));
  });
});
