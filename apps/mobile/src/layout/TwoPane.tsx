import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

import { useWindowClass } from "./useWindowClass";

type Props = { primary: ReactNode; secondary: ReactNode | null };

export function TwoPane({ primary, secondary }: Props) {
  const windowClass = useWindowClass();
  const theme = useTheme();

  if (windowClass === "compact") {
    return secondary != null ? (
      <View style={styles.fill} testID="pane-secondary">
        {secondary}
      </View>
    ) : (
      <View style={styles.fill} testID="pane-primary">
        {primary}
      </View>
    );
  }

  const primaryStyle =
    windowClass === "expanded" ? { flexBasis: "40%" as const, maxWidth: 420 } : { flex: 1 };

  return (
    <View style={styles.row}>
      <View style={[primaryStyle, { borderEndWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border }]} testID="pane-primary">
        {primary}
      </View>
      <View style={styles.fill} testID="pane-secondary">
        {secondary ?? (
          <View style={styles.placeholder} testID="pane-placeholder">
            <Text style={{ color: theme.colors.textMuted, ...theme.type.body }}>—</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
});
