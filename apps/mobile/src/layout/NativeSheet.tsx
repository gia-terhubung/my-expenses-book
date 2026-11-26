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

/**
 * SPIKE (iOS, tab stacks): show an existing sheet body as a native sheet page (route `sheet`), so
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

/** Whether a sheet opened from here should be a native sheet page. */
export function useNativeSheets(): boolean {
  return Platform.OS === "ios" && useContext(TabStackContext);
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
  /** `/sheet` (card) or `/photo` (full screen, black). */
  route?: "/sheet" | "/photo";
}) {
  const open = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;

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
  useEffect(() => () => entry?.dismissed(), []);
  return (
    <NativeSheetContext.Provider value>
      {current?.element ?? null}
    </NativeSheetContext.Provider>
  );
}

/** Apple sheet bar: title on top; X (cancel) and checkmark (done/save) in the bottom toolbar. Icons, so they move into the Duo column. */
export function SheetBar({
  title,
  onCancel,
  onDone,
  doneLabel,
  doneDisabled = false,
  doneIcon = "checkmark",
}: {
  title: string;
  onCancel?: () => void;
  onDone?: () => void;
  doneLabel?: string;
  doneDisabled?: boolean;
  /** SF Symbol for the confirm button (checkmark by default). */
  doneIcon?: "checkmark";
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <>
      <Stack.Screen
        options={{ title, headerShown: true, headerBackVisible: false }}
      />
      {/* Bottom toolbar: X and checkmark sit at the bottom of the Duo column, near the thumb (owner, 2026-11-26). */}
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Spacer />
        {onCancel ? (
          <Stack.Toolbar.Button
            icon="xmark"
            accessibilityLabel={t("common.cancel")}
            onPress={onCancel}
          >
            {t("common.cancel")}
          </Stack.Toolbar.Button>
        ) : null}
        {onDone ? (
          <Stack.Toolbar.Button
            icon={doneIcon}
            variant="prominent"
            tintColor={theme.colors.primary}
            accessibilityLabel={doneLabel ?? t("common.done")}
            disabled={doneDisabled}
            onPress={onDone}
          >
            {doneLabel ?? t("common.done")}
          </Stack.Toolbar.Button>
        ) : null}
      </Stack.Toolbar>
    </>
  );
}
