import { Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

export type MonthBar = {
  /** "YYYY-MM"; also the testID suffix. */
  month: string;
  /** Short month name under the bar. */
  label: string;
  /** Converted home total; 0 draws an empty slot. */
  minor: number;
  /** Printed above the bar (compact amount). */
  value: string;
  accessibilityLabel: string;
  current?: boolean;
  /** Small line under the label, e.g. "to 16" on the running month. */
  /** Amount up to the compared day: drawn as a 2 dp gap across the bar at that level. */
  gapAtMinor?: number;
};

const MAX_BAR = 104;
const MIN_BAR = 4;
const GAP = 2;

/**
 * Column chart of month totals made of plain Views. Past months use the `bar` token, the current
 * month `primary`. `dense` is the 12-month tax-year layout (narrower columns, smaller labels).
 * Columns are bottom-aligned with no fixed heights around text, so large font sizes still line up.
 */
export function MonthBars({ bars, dense = false }: { bars: MonthBar[]; dense?: boolean }) {
  const { colors, type, spacing } = useTheme();
  const max = Math.max(0, ...bars.map((b) => b.minor));
  const small = dense ? { fontSize: 11, lineHeight: 14 } : type.caption;
  const radius = dense ? 3 : 5;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: dense ? spacing.xs : spacing.sm }}>
      {bars.map((b) => {
        const h = b.minor > 0 && max > 0 ? Math.max(MIN_BAR, Math.round((b.minor / max) * MAX_BAR)) : 0;
        const fill = b.current ? colors.primary : colors.bar;
        const low = b.gapAtMinor && b.gapAtMinor > 0 && b.gapAtMinor < b.minor ? Math.round((b.gapAtMinor / b.minor) * h) : 0;
        const top = h - low - GAP;
        const split = low > 0 && top > 0;
        const strong = b.current ? { color: colors.text, fontWeight: "700" as const } : { color: colors.textMuted };
        return (
          <View
            key={b.month}
            testID={`month-bar-${b.month}`}
            accessible
            accessibilityLabel={b.accessibilityLabel}
            style={{ flex: 1, minWidth: 0 }}
          >
            <View style={{ justifyContent: "flex-end", borderBottomWidth: 1, borderBottomColor: colors.border }}>
              {/* Dense columns are narrow: cap font scaling so the compact amount shrinks instead of ellipsizing. */}
              <Text
                testID={`month-bar-value-${b.month}`}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={dense ? 0.5 : 0.6}
                maxFontSizeMultiplier={dense ? 1.2 : undefined}
                style={[small, type.money, strong, { textAlign: "center", marginBottom: spacing.xs }]}
              >
                {b.value}
              </Text>
              {split ? (
                <>
                  <View style={{ height: top, backgroundColor: fill, borderTopLeftRadius: radius, borderTopRightRadius: radius }} />
                  <View testID={`month-bar-gap-${b.month}`} style={{ height: GAP }} />
                  <View style={{ height: low, backgroundColor: fill }} />
                </>
              ) : h > 0 ? (
                <View style={{ height: h, backgroundColor: fill, borderTopLeftRadius: radius, borderTopRightRadius: radius }} />
              ) : null}
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[small, strong, { textAlign: "center", marginTop: 6 }]}>
              {b.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
