import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAddReceiptContext } from "@/capture/AddReceiptProvider";
import { useTheme } from "@/theme/ThemeProvider";

import { RAIL_WIDTH } from "./layout";
import { useLayout } from "./useLayout";
import { TAB_ICONS, TAB_LABEL_KEYS, type TabRoute } from "./tabs";

export type RailVariant = "icons" | "labels";

/**
 * Vertical navigation for layouts wider than a phone. `icons` is the 72 wide icon rail (icon over a
 * caption), `labels` the 200 wide rail (icon and label in a row). Same state as the bottom bar, plus
 * the add + pinned at the bottom, so every tab can add a receipt.
 */
export function SideRail({ state, navigateToTab, variant }: BottomTabBarProps & { variant: RailVariant }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const add = useAddReceiptContext();
  const icons = variant === "icons";
  const { short } = useLayout();

  return (
    <View
      testID="side-rail"
      accessibilityRole="tablist"
      style={[
        styles.rail,
        {
          width: icons ? RAIL_WIDTH.iconRail : RAIL_WIDTH.wideRail,
          backgroundColor: theme.colors.surface,
          borderEndColor: theme.colors.border,
          // Clear of the status area like the system clock on the far side (iPhone Duo open: top
          // inset 0, clock ~40 pt down). The left inset is already reserved by SideSafeArea.
          // Short window (landscape phone): less air above the first tab so the rest fit.
          paddingTop: insets.top + (short ? theme.spacing.lg : theme.spacing.xxl),
          paddingBottom: insets.bottom + theme.spacing.lg,
        },
      ]}
    >
      {/* The tabs scroll (large text on a short window); the + below stays pinned and reachable. */}
      <ScrollView testID="rail-scroll" style={styles.scroll} contentContainerStyle={{ gap: theme.spacing.sm }}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const name = route.name as TabRoute;
        const label = t(TAB_LABEL_KEYS[name]);
        const color = focused ? theme.colors.primary : theme.colors.textMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={() => navigateToTab(route.key)}
            style={({ pressed }) => [
              icons ? styles.itemIcons : styles.itemLabels,
              {
                backgroundColor: focused ? theme.colors.tonal : pressed ? theme.colors.surfacePressed : "transparent",
                borderRadius: theme.radius.pill,
                marginHorizontal: icons ? theme.spacing.sm : theme.spacing.lg,
                ...(icons
                  ? { paddingHorizontal: theme.spacing.xs, paddingVertical: theme.spacing.sm }
                  : { padding: theme.spacing.md, gap: theme.spacing.md, minHeight: theme.size.touch }),
              },
            ]}
          >
            <Ionicons
              name={TAB_ICONS[name]}
              size={22}
              color={color}
              accessible={false}
              importantForAccessibility="no"
            />
            {icons ? (
              <Text
                // Never wrap or ellipsize: "Pengaturan" at 1.3x is wider than the 56 pt item, so it shrinks.
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                maxFontSizeMultiplier={1.3}
                style={[theme.type.caption, styles.caption, { color }]}
              >
                {label}
              </Text>
            ) : (
              <Text style={[theme.type.body, { color: theme.colors.text, fontWeight: focused ? "700" : "400" }]}>
                {label}
              </Text>
            )}
          </Pressable>
        );
      })}
      </ScrollView>
      <Pressable
        testID="rail-add"
        accessibilityRole="button"
        accessibilityLabel={t("capture.add")}
        onPress={add.open}
        style={({ pressed }) => [
          styles.plus,
          {
            marginTop: theme.spacing.sm,
            width: theme.size.plus,
            height: theme.size.plus,
            borderRadius: theme.size.plus / 2,
            backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), ${theme.elevation.raised}`,
          },
        ]}
      >
        <Ionicons name="add" size={26} color={theme.colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { borderEndWidth: StyleSheet.hairlineWidth },
  itemIcons: { minHeight: 56, alignItems: "center", justifyContent: "center", gap: 2 },
  itemLabels: { flexDirection: "row", alignItems: "center" },
  caption: { fontSize: 10, lineHeight: 13, fontWeight: "600" },
  scroll: { flex: 1 },
  plus: { alignSelf: "center", alignItems: "center", justifyContent: "center" },
});
