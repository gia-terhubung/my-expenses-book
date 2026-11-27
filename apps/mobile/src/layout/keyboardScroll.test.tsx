import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard, ScrollView, TextInput } from "react-native";

import { useKeyboardForm } from "./keyboardScroll";

/** iOS (jest-expo default): the field being typed in stays above the keyboard. */
type Listener = (e: { endCoordinates: { height: number; screenY: number } }) => void;
const listeners: Record<string, Listener> = {};
let scrollTo: jest.Mock;
let fieldY = 0;

function Form() {
  const { scrollProps, bottomRoom } = useKeyboardForm();
  return (
    <ScrollView
      {...scrollProps}
      ref={(node) => {
        if (node) (node as { scrollTo: unknown }).scrollTo = scrollTo;
        (scrollProps.ref as { current: unknown }).current = node;
      }}
      contentContainerStyle={{ paddingBottom: bottomRoom }}
    >
      <TextInput testID="a" />
      <TextInput testID="b" />
    </ScrollView>
  );
}

beforeEach(() => {
  scrollTo = jest.fn();
  jest.useFakeTimers();
  jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: Listener) => {
    listeners[event] = cb;
    return { remove: jest.fn() };
  }) as never);
  jest.spyOn(TextInput.State, "currentlyFocusedInput").mockImplementation(
    () =>
      ({
        measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, fieldY, 300, 44),
      }) as never,
  );
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const KEYBOARD = { endCoordinates: { height: 336, screenY: 538 } };

describe("useKeyboardForm", () => {
  it("scrolls the focused field above the keyboard when it opens", async () => {
    await render(<Form />);
    fieldY = 600;
    await act(async () => {
      listeners.keyboardDidShow(KEYBOARD);
      jest.advanceTimersByTime(60);
    });
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 600 + 44 + 24 - 538, animated: true });
  });

  it("scrolls to a second field focused while the keyboard is up", async () => {
    await render(<Form />);
    fieldY = 300; // first field already visible
    await act(async () => {
      listeners.keyboardDidShow(KEYBOARD);
      jest.advanceTimersByTime(60);
    });
    expect(scrollTo).not.toHaveBeenCalled();
    fieldY = 700; // second field, under the keyboard
    await act(async () => {
      fireEvent(screen.getByTestId("b"), "focus");
      jest.advanceTimersByTime(60);
    });
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 700 + 44 + 24 - 538, animated: true });
  });

  it("does not scroll on focus while the keyboard is down", async () => {
    await render(<Form />);
    fieldY = 700;
    await act(async () => {
      fireEvent(screen.getByTestId("b"), "focus");
      jest.advanceTimersByTime(60);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
