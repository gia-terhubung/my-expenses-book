import { router, Stack, type Href } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme/ThemeProvider";

import { useColumnPlusMenu } from "./PlusMenu";

/**
 * iOS: show an existing sheet body as a native sheet page (route `sheet` in tab stacks, `picker`
 * in the modals stack), so
 * its X and checkmark are Apple bar items that move into the iPhone Duo side column. The host keeps
 * today's `visible` / `onClose` contract; the body reads `useInNativeSheet()` and renders `SheetBar`
 * instead of its own header and buttons.
 */
type Entry = { element: ReactNode; dismissed(): void };
let entry: Entry | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** True on every page of a tab stack (set by the tab stack's screenLayout). */
export const TabStackContext = createContext(false);
const NativeSheetContext = createContext(false);
export const useInNativeSheet = () => useContext(NativeSheetContext);

/**
 * The route a sheet body opened from here is shown on: `/sheet` in a tab stack, `/picker` in the
 * modals stack (review, edit, export). Null elsewhere.
 */
export type SheetRoute = "/sheet" | "/picker";
export const SheetRouteContext = createContext<SheetRoute | null>(null);

/**
 * Where a picker opened from here should open as a native sheet page, or null for today's modal:
 * off iOS, outside a sheet-capable stack, and inside a native sheet (one sheet body at a time).
 */
export function useNativeSheetRoute(): SheetRoute | null {
  const route = useContext(SheetRouteContext);
  const inSheet = useContext(NativeSheetContext);
  return Platform.OS === "ios" && !inSheet ? route : null;
}

/** Whether a sheet opened from here should be a native sheet page. */
export function useNativeSheets(): boolean {
  const inTabStack = useContext(TabStackContext);
  // One sheet body at a time: a host inside a sheet body would replace the body it sits in.
  const inSheet = useContext(NativeSheetContext);
  return Platform.OS === "ios" && inTabStack && !inSheet;
}

export function NativeSheetHost({
  visible,
  onClose,
  children,
  route = "/sheet",
}: {
  visible: boolean;
  onClose(): void;
  children: ReactNode;
  /** `/sheet` (card), `/picker` (card over the modals stack) or `/photo` (full screen, black). */
  route?: SheetRoute | "/photo";
}) {
  const open = useRef(false);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Keep the page showing the latest body (state lives in the parent).
  useEffect(() => {
    if (open.current && entry) {
      entry = { ...entry, element: children };
      emit();
    }
  });

  useEffect(() => {
    if (visible && !open.current) {
      open.current = true;
      entry = {
        element: children,
        dismissed: () => {
          // Swiped down (or closed by the page): tell the parent once.
          if (open.current) {
            open.current = false;
            close.current();
          }
        },
      };
      emit();
      router.push(route as unknown as Href);
    } else if (!visible && open.current) {
      open.current = false;
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(
    () => () => {
      if (open.current) {
        open.current = false;
        router.back();
      }
    },
    [],
  );
  return null;
}

/** The `sheet` route: renders the current body and reports when it goes away. */
export function NativeSheetPage() {
  const current = useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => entry,
  );
  // Report only the body this page opened with: by the time the page goes away, the next sheet
  // may already have replaced the shared entry.
  const mine = useRef(entry);
  useEffect(() => () => mine.current?.dismissed(), []);
  return (
    <NativeSheetContext.Provider value>
      {current?.element ?? null}
    </NativeSheetContext.Provider>
  );
}

/**
 * Apple sheet bar: title on top; X (cancel) and checkmark (done/save) as icons, so they move into
 * the Duo column. A sheet puts them in the bottom toolbar, near the thumb. A form shown inside a page
 * that keeps the tab bar (`placement="top"`) puts them at the top of the column instead, after Back
 * and before the +, because the tab bar takes the bottom there.
 */
export function SheetBar({
  title,
  onCancel,
  onDone,
  doneLabel,
  doneDisabled = false,
  doneIcon = "checkmark",
  placement = "bottom",
}: {
  title: string;
  onCancel?: () => void;
  onDone?: () => void;
  doneLabel?: string;
  doneDisabled?: boolean;
  /** SF Symbol for the confirm button (checkmark by default). */
  doneIcon?: "checkmark";
  placement?: "bottom" | "top";
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const top = placement === "top";
  const { menu: plusMenu } = useColumnPlusMenu(top);
  // Native toolbars read their direct children only, so these stay a list, not a fragment.
  const buttons = [
    onCancel ? (
      <Stack.Toolbar.Button
        key="cancel"
        icon="xmark"
        accessibilityLabel={t("common.cancel")}
        onPress={onCancel}
      >
        {t("common.cancel")}
      </Stack.Toolbar.Button>
    ) : null,
    onDone ? (
      <Stack.Toolbar.Button
        key="done"
        icon={doneIcon}
        variant="prominent"
        tintColor={theme.colors.primary}
        accessibilityLabel={doneLabel ?? t("common.done")}
        disabled={doneDisabled}
        onPress={onDone}
      >
        {doneLabel ?? t("common.done")}
      </Stack.Toolbar.Button>
    ) : null,
  ];
  return (
    <>
      {/* In a page, keep its Back; a sheet has none. */}
      <Stack.Screen
        options={
          top
            ? { title }
            : { title, headerShown: true, headerBackVisible: false }
        }
      />
      {top ? (
        <Stack.Toolbar placement="right">
          {buttons}
          {plusMenu}
        </Stack.Toolbar>
      ) : (
        <Stack.Toolbar placement="bottom">
          <Stack.Toolbar.Spacer />
          {buttons}
        </Stack.Toolbar>
      )}
    </>
  );
}
