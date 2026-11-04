import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme/ThemeProvider";

import { TAB_LABEL_KEYS, type TabRoute } from "./tabs";

/** Vertical navigation for medium/expanded widths. Same state as the bottom bar. */
export function SideRail({ state, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID="side-rail"
      accessibilityRole="tablist"
      style={[
        styles.rail,
        {
          backgroundColor: theme.colors.surface,
          borderEndColor: theme.colors.border,
          paddingTop: insets.top + theme.spacing.lg,
          paddingStart: insets.left,
          gap: theme.spacing.sm,
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
            style={[
              styles.item,
              {
                backgroundColor: focused ? theme.colors.primary : "transparent",
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                marginHorizontal: theme.spacing.sm,
              },
            ]}
          >
            <Text
              style={[
                theme.type.body,
                { color: focused ? theme.colors.onPrimary : theme.colors.text },
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
  rail: { width: 200, borderEndWidth: StyleSheet.hairlineWidth },
  item: { alignItems: "flex-start" },
});
