import { Stack } from "expo-router";
import { useVerticalBarEdgeIOS } from "expo-status-bar";
import { createContext, useContext, useEffect } from "react";
import { useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";

import { useAddReceiptContext } from "@/capture/AddReceiptProvider";
import type { CaptureChoice } from "@/capture/CaptureSheet";
import { useTheme } from "@/theme/ThemeProvider";

import { useInNativeTabs, useNavSpike } from "./navSpike";

/**
 * SPIKE (iOS, owner 2026-11-26): the + opens Apple's menu (icon + word per row) instead of the
 * add sheet, and in the Duo side column it comes after the page's own buttons.
 */
export const PLUS_CHOICES: {
  mode: CaptureChoice;
  icon: "doc.viewfinder" | "photo.on.rectangle" | "square.and.pencil";
  key: string;
}[] = [
  { mode: "scan", icon: "doc.viewfinder", key: "capture.scan" },
  { mode: "photos", icon: "photo.on.rectangle", key: "capture.import" },
  { mode: "manual", icon: "square.and.pencil", key: "capture.manual" },
];

/** A page that has its own right-side header buttons claims the column + to put it last among them. */
export const PlusClaimContext = createContext<(() => () => void) | null>(null);

/**
 * Below this window height the side column cannot hold Back, two page buttons and the + above the
 * tab group (the folded iPhone Duo held sideways is 466 pt): the + floats and page buttons fold into ⋯.
 * By available height, never by device model.
 */
export const SHORT_COLUMN_HEIGHT = 560;

/** True when the window has a side column that is too short for the full set of header buttons. */
export function useShortColumn(): boolean {
  const edge = useVerticalBarEdgeIOS();
  const { height } = useWindowDimensions();
  return edge !== null && height < SHORT_COLUMN_HEIGHT;
}

/** True when this page shows the + in the Duo side column (variant B with a tall side column). */
export function useColumnPlus(): boolean {
  const inNativeTabs = useInNativeTabs();
  const { plus } = useNavSpike();
  const edge = useVerticalBarEdgeIOS();
  const short = useShortColumn();
  return inNativeTabs && plus === "B" && edge !== null && !short;
}

/**
 * The + menu element for the end of a page's own `Stack.Toolbar placement="right"` (toolbars read
 * their direct children, so this is an element, not a wrapper component). Null when the page does
 * not show the column +. Claims the column + so the tab stack does not add a second one.
 */
export function useColumnPlusMenu(enabled = true) {
  const show = useColumnPlus() && enabled;
  const claim = useContext(PlusClaimContext);
  useEffect(() => (show && claim ? claim() : undefined), [show, claim]);
  const menu = usePlusMenu();
  return show ? menu : null;
}

/** The + menu element (inside a Stack.Toolbar). */
export function usePlusMenu() {
  const { t } = useTranslation();
  const theme = useTheme();
  const add = useAddReceiptContext();
  return (
    <Stack.Toolbar.Menu
      icon="plus"
      variant="prominent"
      tintColor={theme.colors.primary}
      accessibilityLabel={t("capture.add")}
    >
      {PLUS_CHOICES.map((c) => (
        <Stack.Toolbar.MenuAction
          key={c.mode}
          icon={c.icon}
          onPress={() => void add.start(c.mode)}
        >
          {t(c.key)}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>
  );
}
