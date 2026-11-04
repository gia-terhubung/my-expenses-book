import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme/ThemeProvider";

import { TAB_LABEL_KEYS, type TabRoute } from "./tabs";

/** Compact-width bottom tab bar. */
export function BottomTabs({ state, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="tab-bar"
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            onPress={() => navigateToTab(route.key)}
            style={[styles.item, { padding: theme.spacing.md }]}
          >
            <Text
              style={[
                theme.type.caption,
                { color: focused ? theme.colors.primary : theme.colors.textMuted, fontWeight: focused ? "700" : "400" },
              ]}
            >
              {t(TAB_LABEL_KEYS[route.name as TabRoute])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: "center" },
});
