import { fireEvent, render, screen } from "@testing-library/react-native";

import { DateFieldText } from "./DateFieldText";

describe("DateFieldText", () => {
  it("typing reports the string", async () => {
    const onChange = jest.fn();
    await render(<DateFieldText label="Date" value="" onChange={onChange} />);
    await fireEvent.changeText(screen.getByLabelText("Date"), "2026-11-07");
    expect(onChange).toHaveBeenCalledWith("2026-11-07");
  });

  it("renders the error and exposes it in accessibilityHint", async () => {
    await render(<DateFieldText label="Date" value="x" onChange={() => {}} error="Enter a valid date" />);
    expect(screen.getByText("Enter a valid date")).toBeTruthy();
    expect(screen.getByLabelText("Date").props.accessibilityHint).toBe("Enter a valid date");
  });
});
