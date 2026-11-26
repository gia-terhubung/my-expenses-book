import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ScrollViewProps,
} from "react-native";

/** Props for a scrolling form with text fields (both platforms). */
export const KEYBOARD_SCROLL_PROPS: ScrollViewProps =
  Platform.OS === "ios"
    ? { keyboardShouldPersistTaps: "handled", keyboardDismissMode: "interactive" }
    : { keyboardShouldPersistTaps: "handled" };

/** Bottom room under the last field so it clears the native bottom toolbar (iOS). */
export const FORM_BOTTOM_ROOM = Platform.OS === "ios" ? 96 : 0;

/** Gap kept between the focused field and the top of the keyboard. */
const KEYBOARD_GAP = 24;

/**
 * Keeps the field being typed in above the keyboard on iOS (owner, 2026-11-26: the keyboard
 * covered Notes and the form could not scroll far enough). While the keyboard is up the form gets
 * extra bottom room of the keyboard's height, and when it opens the focused field is scrolled to sit
 * just above it. Spread `scrollProps` on the form's ScrollView and add `bottomRoom` to its bottom
 * padding. Works in page sheets and under native headers, where KeyboardAvoidingView's offset was off.
 */
export function useKeyboardForm() {
  const ref = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const [kb, setKb] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const reveal = (keyboardTop: number) => {
      const input = TextInput.State.currentlyFocusedInput();
      if (!input || !ref.current) return;
      input.measureInWindow((_x, y, _w, h) => {
        const over = y + h + KEYBOARD_GAP - keyboardTop;
        if (over > 0) ref.current?.scrollTo({ y: offset.current + over, animated: true });
      });
    };
    const shown = Keyboard.addListener("keyboardDidShow", (e) => {
      setKb(e.endCoordinates.height);
      // After the extra room has laid out.
      setTimeout(() => reveal(e.endCoordinates.screenY), 50);
    });
    const hidden = Keyboard.addListener("keyboardWillHide", () => setKb(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  const scrollProps = {
    ref,
    scrollEventThrottle: 16,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
    },
  };
  return { scrollProps, bottomRoom: FORM_BOTTOM_ROOM + kb };
}

/** Bottom room only (forms that do not need the auto-scroll). */
export function useFormBottomRoom(): number {
  return useKeyboardForm().bottomRoom;
}
