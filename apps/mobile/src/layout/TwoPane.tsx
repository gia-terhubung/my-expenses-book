import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

import { useLayout } from "./useLayout";

type Props = { primary: ReactNode; secondary: ReactNode | null };

/** Props for a pane that stays mounted (scroll, local state) but is not shown or announced. */
const hiddenPane = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants" as const,
};

/**
 * List-detail layout. When the pane area allows it (`layout.split`) both panes show side by side,
 * the list at a fixed `listWidth`; otherwise one pane shows: `secondary` when non-null, else
 * `primary`. Both panes keep the same tree position and the same style keys in every layout (the
 * hidden one gets display:none), so fold/unfold never remounts them or re-resolves their widths:
 * scroll offsets, loaded windows and in-progress edits survive.
 */
export function TwoPane({ primary, secondary }: Props) {
  const { split, listWidth } = useLayout();
  const theme = useTheme();
  const { t } = useTranslation();
  const showPrimary = split || secondary == null;
  const showSecondary = split || secondary != null;

  const primaryStyle = {
    // Width, not flexBasis: on RN 0.88 Fabric a runtime flexBasis change (0 -> listWidth on unfold)
    // is not re-laid out and the list pane stays 0 wide (F1, seen on the iPhone Duo).
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto" as const,
    width: split ? listWidth : ("100%" as const),
    borderEndWidth: split ? StyleSheet.hairlineWidth : 0,
    borderColor: theme.colors.border,
  };

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
        style={[styles.detail, !showSecondary && styles.hidden]}
        testID="pane-secondary"
        {...(showSecondary ? null : hiddenPane)}
      >
        {secondary ??
          (!split ? null : (
            <View
              style={[
                styles.placeholder,
                { backgroundColor: theme.colors.background },
              ]}
              testID="pane-placeholder"
            >
              <Text
                style={{ color: theme.colors.textMuted, ...theme.type.body }}
              >
                {t("empty.document")}
              </Text>
            </View>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  row: { flex: 1, flexDirection: "row" },
  hidden: { display: "none" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
});
