import { fireEvent, render, screen } from "@testing-library/react-native";

import { initI18n } from "@/i18n";

import { DayGrid } from "./DayGrid";

beforeAll(() => initI18n("en"));

describe("DayGrid", () => {
  it("renders 28 day cells with the selected one checked, and reports taps", async () => {
    const onChange = jest.fn();
    await render(<DayGrid value={25} onChange={onChange} />);
    expect(screen.getAllByLabelText(/^Day \d+$/)).toHaveLength(28);
    expect(screen.getByLabelText("Day 25").props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText("Day 3").props.accessibilityState.checked).toBe(false);
    expect(screen.queryByLabelText("Last day")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Day 3"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("offers a Last day chip (-1) when allowed", async () => {
    const onChange = jest.fn();
    await render(<DayGrid value={-1} onChange={onChange} allowLastDay />);
    expect(screen.getByLabelText("Last day").props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByLabelText("Last day"));
    expect(onChange).toHaveBeenCalledWith(-1);
  });
});
