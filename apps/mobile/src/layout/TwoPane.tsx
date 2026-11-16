import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

import { useWindowClass } from "./useWindowClass";

type Props = { primary: ReactNode; secondary: ReactNode | null };

/** Props for a pane that stays mounted (scroll, local state) but is not shown or announced. */
const hiddenPane = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants" as const,
};

/**
 * List-detail layout. Compact shows `secondary` when non-null, else `primary`; medium/expanded
 * show both side by side. Both panes keep the same tree position for every window class (the
 * compact-hidden one gets display:none), so fold/unfold never remounts them: scroll offsets,
 * loaded windows and in-progress edits survive.
 */
export function TwoPane({ primary, secondary }: Props) {
  const windowClass = useWindowClass();
  const theme = useTheme();
  const { t } = useTranslation();
  const compact = windowClass === "compact";
  const showPrimary = !compact || secondary == null;
  const showSecondary = !compact || secondary != null;

  const primaryStyle = compact
    ? styles.fill
    : [
        windowClass === "expanded" ? { flexBasis: "40%" as const, maxWidth: 420 } : styles.fill,
        { borderEndWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border },
      ];

  return (
    <View style={styles.row}>
      <View
        style={[primaryStyle, !showPrimary && styles.hidden]}
        testID="pane-primary"
        {...(showPrimary ? null : hiddenPane)}
      >
        {primary}
      </View>
      <View
        style={[styles.fill, !showSecondary && styles.hidden]}
        testID="pane-secondary"
        {...(showSecondary ? null : hiddenPane)}
      >
        {secondary ??
          (compact ? null : (
            <View style={[styles.placeholder, { backgroundColor: theme.colors.background }]} testID="pane-placeholder">
              <Text style={{ color: theme.colors.textMuted, ...theme.type.body }}>{t("empty.document")}</Text>
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  hidden: { display: "none" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
});
