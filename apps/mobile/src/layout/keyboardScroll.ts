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
 * extra bottom room of the keyboard's height, and when it opens, or another field is focused while it is up,
 * the focused field is scrolled to sit just above it. Spread `scrollProps` on the form's ScrollView and add `bottomRoom` to its bottom
 * padding. Works in page sheets and under native headers, where KeyboardAvoidingView's offset was off.
 */
export function useKeyboardForm() {
  const ref = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  // Top of the open keyboard in window coordinates; null while it is down.
  const keyboardTop = useRef<number | null>(null);
  const [kb, setKb] = useState(0);

  const reveal = () => {
    const top = keyboardTop.current;
    const input = TextInput.State.currentlyFocusedInput();
    if (top === null || !input || !ref.current) return;
    input.measureInWindow((_x, y, _w, h) => {
      const over = y + h + KEYBOARD_GAP - top;
      if (over > 0) ref.current?.scrollTo({ y: offset.current + over, animated: true });
    });
  };
  const revealSoon = () => setTimeout(reveal, 50);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const shown = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKb(e.endCoordinates.height);
      // After the extra room has laid out.
      revealSoon();
    });
    const hidden = Keyboard.addListener("keyboardWillHide", () => {
      keyboardTop.current = null;
      setKb(0);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollProps = {
    ref,
    scrollEventThrottle: 16,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = e.nativeEvent.contentOffset.y;
    },
    // A field focused while the keyboard is already up (focus bubbles from the TextInput): no
    // keyboardDidShow comes, so reveal it here.
    onFocus: () => {
      if (keyboardTop.current !== null) revealSoon();
    },
  };
  return { scrollProps, bottomRoom: FORM_BOTTOM_ROOM + kb };
}

/** Bottom room only (forms that do not need the auto-scroll). */
export function useFormBottomRoom(): number {
  return useKeyboardForm().bottomRoom;
}
