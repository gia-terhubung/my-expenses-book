import type { ReactNode } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { useSideInsets } from "@/layout/SideSafeArea";
import { useTheme } from "@/theme/ThemeProvider";

import type { GuideMode } from "./guideLayout";

type Props = {
  mode: GuideMode;
  dots: { n: number; total: number };
  title: string;
  /** Text, live example and drawings: the left pane in split mode. */
  explain: ReactNode;
  /** The picker: the right pane in split mode. */
  control?: ReactNode;
  /** True when the control scrolls itself (a list); otherwise the pane scrolls it. */
  controlScrolls?: boolean;
  /**
   * A short control that must stay whole (the day grid): in one column it keeps its height and
   * the explanation scrolls in what is left. Not in short windows, where the title comes first.
   */
  controlFixed?: boolean;
  footer: ReactNode;
  /** Replay only: the Close button. */
  onClose?: () => void;
};

/**
 * The guide's page. One element tree in every mode; only styles change, so a fold, unfold or
 * rotation never remounts the picker (selection and search text survive). In split mode each pane
 * is half the window, so the gutter sits on the fold of the open Duo / Fold.
 */
export function GuideShell({ mode, dots, title, explain, control, controlScrolls = false, controlFixed = false, footer, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, type, spacing, size } = useTheme();
  const insets = useSafeAreaInsets();
  const side = useSideInsets();
  const { width } = useWindowDimensions();
  const split = mode === "split";
  const short = mode === "short";
  const pad = short ? spacing.lg : spacing.xl;

  const column = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;
  const fixed = controlFixed && mode === "column";
  const leftPane = split
    ? { width: width / 2 - side.left, flexGrow: 0, flexShrink: 0 }
    : fixed
      ? { ...column, flexGrow: 0, flexShrink: 1 }
      : { ...column, flexGrow: 0, flexShrink: 1, maxHeight: short ? "40%" : "60%" };
  const rightPane = split
    ? { width: width / 2 - side.right, flexGrow: 0, flexShrink: 0 }
    : fixed
      ? { ...column, flexGrow: 1, flexShrink: 0 }
      : { ...column, flexGrow: 1, flexShrink: 1 };

  const label = t("guide.stepOf", { n: dots.n, total: dots.total });
  // Same element per step in every mode: a fixed control only changes style (sized to its content
  // in one column, scrolling in a short window), so rotation never remounts it.
  const Control = controlScrolls ? View : ScrollView;
  const controlProps = controlScrolls
    ? { style: { flex: 1 } }
    : fixed
      ? { testID: "guide-control-scroll", style: { flexGrow: 0 }, keyboardShouldPersistTaps: "handled" as const }
    : { testID: "guide-control-scroll", style: { flex: 1 }, contentContainerStyle: { paddingBottom: spacing.md }, keyboardShouldPersistTaps: "handled" as const };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingBottom: insets.bottom + (short ? spacing.sm : spacing.lg) }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: size.touch,
          paddingHorizontal: pad,
          paddingTop: short ? 0 : spacing.sm,
        }}
      >
        <View accessible accessibilityLabel={label} style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center" }}>
          {Array.from({ length: dots.total }, (_, i) => (
            <View
              key={i}
              style={{
                width: i + 1 === dots.n ? 20 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i + 1 <= dots.n ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
        {onClose ? (
          <View style={{ marginRight: -spacing.md }}>
            <IconButton icon="close" label={t("guide.close")} onPress={onClose} />
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, flexDirection: split ? "row" : "column" }}>
        <ScrollView
          testID="guide-explain"
          style={leftPane}
          contentContainerStyle={{ padding: pad, paddingTop: spacing.md, gap: spacing.lg }}
        >
          <Text accessibilityRole="header" style={[short ? type.title : type.headline, { color: colors.text }]}>
            {title}
          </Text>
          {explain}
        </ScrollView>
        <View
          testID="guide-control"
          style={[
            rightPane,
            {
              paddingHorizontal: pad,
              paddingTop: split ? spacing.xl + spacing.md : 0,
              gap: spacing.md,
              borderStartWidth: split ? 1 : 0,
              borderColor: colors.border,
            },
          ]}
        >
          <Control {...controlProps}>{control}</Control>
          {/* Spare room sits above the buttons, so a short control follows its text directly. */}
          <View testID="guide-footer-spacer" style={{ flexGrow: fixed ? 1 : 0 }} />
          {footer}
        </View>
      </View>
    </View>
  );
}
