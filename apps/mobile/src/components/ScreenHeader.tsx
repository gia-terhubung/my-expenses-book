import { router, Stack } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Text, View } from "react-native";

import { useInTabRoot } from "@/layout/navSpike";
import { useColumnPlusMenu } from "@/layout/PlusMenu";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme/ThemeProvider";

import { IconButton } from "./IconButton";

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/**
 * The one page header: round back chevron and title on one row, optional actions at the end.
 * The chevron's hit area hangs into the gutter so its glyph lines up with the content edge.
 */
export function ScreenHeader({
  title,
  onBack = goBack,
  actions,
  titleStyle = "title",
  toolbar,
}: {
  title: string;
  /** Defaults to going back (or Home when there is nothing to go back to); null hides the chevron. */
  onBack?: (() => void) | null;
  actions?: ReactNode;
  titleStyle?: "title" | "headline";
  /** SPIKE (iOS): `Stack.Toolbar` items for the native header (they replace `actions` there). */
  toolbar?: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors, type, spacing, size } = useTheme();
  const inTabRoot = useInTabRoot();
  const { menu: plusMenu, submenu: plusSubmenu } = useColumnPlusMenu(
    Platform.OS === "ios" && onBack !== null && !inTabRoot && toolbar != null,
  );
  // SPIKE (iOS): a page with a back control on a stack screen uses the native header, so Back and its
  // actions move into the iPhone Duo side column. Not on a tab root (its detail pane has no stack header).
  if (Platform.OS === "ios" && onBack !== null && !inTabRoot) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title }} />
        {toolbar ? (
          <Stack.Toolbar placement="right">
            {toolbar}
            {plusMenu}
          </Stack.Toolbar>
        ) : null}
      </>
    );
  }
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: size.touch,
        marginLeft: onBack ? -spacing.md : 0,
        gap: spacing.xs,
      }}
    >
      {onBack ? (
        <IconButton
          icon="chevron-back"
          label={t("common.back")}
          onPress={onBack}
        />
      ) : null}
      <Text
        accessibilityRole="header"
        numberOfLines={2}
        style={[
          type[titleStyle],
          { color: colors.text, flexShrink: 1, flexGrow: 1 },
        ]}
      >
        {title}
      </Text>
      {actions ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          {actions}
        </View>
      ) : null}
    </View>
  );
}
