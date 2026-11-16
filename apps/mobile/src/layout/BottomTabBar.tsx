import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAddReceipt } from "@/capture/useAddReceipt";
import { useTheme } from "@/theme/ThemeProvider";

import { TAB_ICONS, TAB_LABEL_KEYS, type TabRoute } from "./tabs";
import { TAB_BAR_LIFT } from "./useTabBarSpace";

/**
 * Compact-width floating "duo": a capsule of 4 tabs plus a round + that opens the add sheet from
 * every tab. It floats over the screens (no blur: a near-opaque surface), so tab screens pad their
 * scroll content by `useTabBarSpace()`.
 */
export function BottomTabs({ state, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const add = useAddReceipt();
  const highlight = theme.scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.55)";

  return (
    <View testID="tab-bar" style={[styles.bar, { bottom: insets.bottom + TAB_BAR_LIFT }]}>
      <View
        testID="tab-capsule"
        accessibilityRole="tablist"
        style={[
          styles.capsule,
          {
            minHeight: theme.size.capsule,
            borderRadius: theme.size.capsule / 2,
            backgroundColor: `${theme.colors.surface}EB`,
            borderColor: theme.colors.border,
            boxShadow: `inset 0 1px 0 ${highlight}, ${theme.elevation.raised}`,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const color = focused ? theme.colors.primary : theme.colors.textMuted;
          const name = route.name as TabRoute;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={t(TAB_LABEL_KEYS[name])}
              accessibilityState={{ selected: focused }}
              onPress={() => navigateToTab(route.key)}
              style={[styles.tab, focused ? { backgroundColor: theme.colors.tonal } : null]}
            >
              <Ionicons
                name={TAB_ICONS[name]}
                size={22}
                color={color}
                accessible={false}
                importantForAccessibility="no"
              />
              <Text
                // Never ellipsize: "Pengaturan" at 1.3x is wider than a 360 dp phone's tab, so it shrinks.
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                maxFontSizeMultiplier={1.3}
                style={[theme.type.caption, styles.label, { color }]}
              >
                {t(TAB_LABEL_KEYS[name])}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("capture.add")}
        onPress={add.open}
        style={({ pressed }) => [
          styles.plus,
          {
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
      {add.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  capsule: { flex: 1, flexDirection: "row", borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  tab: { flex: 1, minWidth: 0, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 24, paddingHorizontal: 4 },
  label: { fontSize: 10, lineHeight: 13, fontWeight: "600" },
  plus: { alignItems: "center", justifyContent: "center" },
});
