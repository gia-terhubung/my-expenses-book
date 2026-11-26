import { Platform, Pressable, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

import {
  setNavSpike,
  useNavSpike,
  type PlusVariant,
  type TabPlacement,
} from "./navSpike";

const PLACEMENTS: TabPlacement[] = ["tabBar", "sidebar", "automatic"];
const PLUS: PlusVariant[] = ["B", "C", "D", "E"];

/** SPIKE dev tools: tab placement and + variant, live, iOS only. English only (dev). */
export function NavSpikeSwitches() {
  const theme = useTheme();
  const nav = useNavSpike();
  if (Platform.OS !== "ios") return null;
  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: theme.spacing.md,
        justifyContent: "center",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: on ? theme.colors.primary : theme.colors.border,
        backgroundColor: on ? theme.colors.tonal : "transparent",
      }}
    >
      <Text
        style={[
          theme.type.body,
          { color: on ? theme.colors.primary : theme.colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const row = (title: string, chips: React.ReactNode) => (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>
        {title}
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.spacing.sm,
        }}
      >
        {chips}
      </View>
    </View>
  );
  return (
    <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
      {row(
        "Tab placement (iOS 27+)",
        PLACEMENTS.map((p) =>
          chip(p, nav.placement === p, () => setNavSpike({ placement: p })),
        ),
      )}
      {row(
        "+ variant (D = toolbar on every tab page)",
        PLUS.map((p) =>
          chip(
            {
              B: "B under Back",
              C: "C floating",
              D: "D toolbar",
              E: "E accessory",
            }[p],
            nav.plus === p,
            () => setNavSpike({ plus: p }),
          ),
        ),
      )}
    </View>
  );
}
