import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { useCallback } from "react";
import { BackHandler, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { StatusBarInset } from "@/layout/StatusBarInset";
import { TwoPane } from "@/layout/TwoPane";
import { useLayout } from "@/layout/useLayout";
import { useTheme } from "@/theme/ThemeProvider";

import { RecurringList } from "./RecurringList";
import { RuleForm } from "./RuleForm";

/** The `selected` param value for a new rule in the form pane. */
export const NEW_RULE = "new";

const openForm = (id: string) => router.push({ pathname: "/recurring/[id]", params: { id } } as unknown as Href);

/**
 * Settings > Recurring. One pane (phones, Duo closed or sideways, flip covers): the list, and a
 * tapped rule pushes /recurring/[id]. Split (Duo open landscape, foldable inner screens): list
 * left, form right. The open rule lives in the `selected` param, so folding shows that form alone
 * (with a back control) and unfolding puts the list back beside it, typed values kept.
 */
export function RecurringScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { split } = useLayout();
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const clear = useCallback(() => router.setParams({ selected: undefined }), []);

  // Focus-scoped: one pane with a form open, hardware back closes the form, not the screen.
  useFocusEffect(
    useCallback(() => {
      if (split || !selected) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        clear();
        return true;
      });
      return () => sub.remove();
    }, [split, selected, clear]),
  );

  const open = useCallback((id: string) => (split ? router.setParams({ selected: id }) : openForm(id)), [split]);

  const form = selected ? (
    <StatusBarInset>
      <RuleForm
        // A different rule (or "new" -> the saved rule) starts from its own values.
        key={selected}
        ruleId={selected === NEW_RULE ? null : selected}
        onSaved={(rule) => router.setParams({ selected: rule.id })}
        onDeleted={clear}
        onBack={!split ? clear : undefined}
      />
    </StatusBarInset>
  ) : split ? (
    <View testID="recurring-placeholder" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.xl, backgroundColor: theme.colors.background }}>
      <Text style={[theme.type.body, { color: theme.colors.textMuted, textAlign: "center" }]}>{t("recurring.placeholder")}</Text>
    </View>
  ) : null;

  return (
    <TwoPane
      primary={
        <StatusBarInset>
          <RecurringList
            selectedId={selected && selected !== NEW_RULE ? selected : null}
            onSelect={open}
            onNew={() => open(NEW_RULE)}
            onBack={() => router.back()}
          />
        </StatusBarInset>
      }
      secondary={form}
    />
  );
}
