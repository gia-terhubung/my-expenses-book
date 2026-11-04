import { useWindowDimensions } from "react-native";

import { windowClassFor, type WindowClass } from "./windowClass";

export function useWindowClass(): WindowClass {
  const { width } = useWindowDimensions();
  return windowClassFor(width);
}
