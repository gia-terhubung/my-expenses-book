import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback } from "react";

import { NativeSheetPage } from "@/layout/NativeSheet";
import { themedStatusBarStyle } from "@/theme/ThemedStatusBar";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * iOS: the full-screen receipt photo as a native page (see PageViewer). The page is black, so the
 * status icons (on the iPhone Duo, its side column) go light while it is open: the app-wide
 * ThemedStatusBar would otherwise keep them dark, as Home does for its green slip.
 */
export default function PhotoRoute() {
  const theme = useTheme();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle(themedStatusBarStyle(theme.scheme));
    }, [theme.scheme]),
  );
  return <NativeSheetPage />;
}
