import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback } from "react";

import { themedStatusBarStyle } from "@/theme/ThemedStatusBar";
import { useTheme } from "@/theme/ThemeProvider";

import { NativeSheetPage } from "./NativeSheet";

/**
 * iOS: the full-screen receipt photo as a native page (see PageViewer), in a tab stack (`/photo`)
 * or the modals stack (`/review-photo`). The page is black, so the status icons (on the iPhone Duo, its side column) go light while it is open: the app-wide
 * ThemedStatusBar would otherwise keep them dark, as Home does for its green slip.
 */
export function PhotoPage() {
  const theme = useTheme();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle(themedStatusBarStyle(theme.scheme));
    }, [theme.scheme]),
  );
  return <NativeSheetPage />;
}
