import { Stack } from "expo-router";
import { useVerticalBarEdgeIOS } from "expo-status-bar";
import { createContext, useContext, useEffect } from "react";
import { useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";

import { useMaybeAddReceiptContext } from "@/capture/addReceiptContext";
import type { CaptureChoice } from "@/capture/CaptureSheet";
import { useTheme } from "@/theme/ThemeProvider";

import { useInNativeTabs } from "./navSpike";

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
 * tab group (the folded iPhone Duo held sideways is 466 pt): page buttons fold into ⋯, and on a
 * page with ⋯ the + becomes its "Add receipt" row (owner, 2026-11-26: no floating + there).
 * By available height, never by device model.
 */
export const SHORT_COLUMN_HEIGHT = 560;

/** True when the window has a side column that is too short for the full set of header buttons. */
export function useShortColumn(): boolean {
  const edge = useVerticalBarEdgeIOS();
  const { height } = useWindowDimensions();
  return edge !== null && height < SHORT_COLUMN_HEIGHT;
}

/** True when this page shows the + in the Duo side column. */
export function useColumnPlus(): boolean {
  const inNativeTabs = useInNativeTabs();
  const edge = useVerticalBarEdgeIOS();
  return inNativeTabs && edge !== null;
}

/**
 * The + menu element for the end of a page's own `Stack.Toolbar placement="right"` (toolbars read
 * their direct children, so this is an element, not a wrapper component). Null when the page does
 * not show the column +. Claims the column + so the tab stack does not add a second one.
 */
export function useColumnPlusMenu(enabled = true) {
  // Outside the tabs (modals: export, review) there is no add flow and no +.
  const columnPlus = useColumnPlus();
  const addFlow = useMaybeAddReceiptContext();
  const show = columnPlus && enabled && addFlow !== null;
  const short = useShortColumn();
  const claim = useContext(PlusClaimContext);
  useEffect(() => (show && claim ? claim() : undefined), [show, claim]);
  const menu = usePlusMenu();
  const submenu = usePlusSubmenu();
  // Short column: the + is the "Add receipt" row inside the page's ⋯ (placed by the page).
  return {
    menu: show && !short ? menu : null,
    submenu: show && short ? submenu : null,
  };
}

/** "Add receipt" as a submenu row (inside a page's ⋯ menu): Scan / Import / Add manually. */
export function usePlusSubmenu() {
  const { t } = useTranslation();
  const add = useMaybeAddReceiptContext();
  return (
    <Stack.Toolbar.Menu icon="plus" title={t("capture.add")}>
      {PLUS_CHOICES.map((c) => (
        <Stack.Toolbar.MenuAction
          key={c.mode}
          icon={c.icon}
          onPress={() => void add?.start(c.mode)}
        >
          {t(c.key)}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>
  );
}

/** The + menu element (inside a Stack.Toolbar). */
export function usePlusMenu() {
  const { t } = useTranslation();
  const theme = useTheme();
  const add = useMaybeAddReceiptContext();
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
          onPress={() => void add?.start(c.mode)}
        >
          {t(c.key)}
        </Stack.Toolbar.MenuAction>
      ))}
    </Stack.Toolbar.Menu>
  );
}
