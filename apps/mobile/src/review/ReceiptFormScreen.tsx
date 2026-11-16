import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { useDb } from "@/db/DatabaseProvider";
import { listCategories } from "@/db/repositories/categories";
import { TwoPane } from "@/layout/TwoPane";
import { useWindowClass } from "@/layout/useWindowClass";
import { useTheme } from "@/theme/ThemeProvider";

import { DuplicateBanner } from "./DuplicateBanner";
import { PageViewer } from "./PageViewer";
import { ReviewFields } from "./ReviewFields";
import { goNext, ReviewValidationError, useReviewForm, type ReviewFormMode } from "./useReviewForm";

/** Props for a view that stays mounted but is not shown or announced (same as TwoPane's hidden pane). */
const hiddenView = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants" as const,
};

/**
 * Receipt form screen behind the review and edit routes: photo + fields.
 *
 * - `review`: confirm a draft. `queue` = comma-separated draft ids still to review after this one;
 *   `failed`/`total` = photos the capture run couldn't save (shown once).
 * - `edit`: change a confirmed receipt; Cancel / Save, nothing written before Save.
 *
 * The tree is the same for every window class (fold/rotate): the fields and both page viewers
 * keep their positions and only change style, so typed values, focus and decrypted views survive.
 * With pages, TwoPane holds a full-height viewer (shown side by side) and the form; compact hides
 * the viewer pane and shows an inline viewer inside the form instead.
 */
export function ReceiptFormScreen({ mode }: { mode: ReviewFormMode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const windowClass = useWindowClass();
  const params = useLocalSearchParams<{ id: string; queue?: string; failed?: string; total?: string }>();
  const editing = mode === "edit";
  const queue = useMemo(
    () => (!editing && params.queue ? params.queue.split(",").filter(Boolean) : []),
    [editing, params.queue],
  );
  // Above the TwoPane split, so the form state outlives any layout change.
  const form = useReviewForm(params.id, { queue, mode });
  const categories = useMemo(() => listCategories(db), [db]);
  const failed = editing ? 0 : Number(params.failed ?? 0);

  // Review: draft already saved or discarded (stale queue entry), move on. Edit: receipt gone or
  // not confirmed, close.
  useEffect(() => {
    if (form.receipt !== "missing") return;
    if (editing) router.back();
    else goNext(queue);
  }, [editing, form.receipt, queue]);

  if (form.receipt === "missing") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const save = () => {
    form.save().catch((e: unknown) => {
      if (e instanceof ReviewValidationError) {
        // Shown inline; announced too, since the first error may be off screen.
        const first = Object.values(e.errors).find(Boolean);
        if (first) AccessibilityInfo.announceForAccessibility(t(first));
        return;
      }
      if (__DEV__) console.warn("receipt save failed", e);
      Alert.alert(t("review.saveFailed"));
    });
  };
  const discard = () =>
    Alert.alert(t("review.discardTitle"), t("review.discardMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("review.discard"),
        style: "destructive",
        onPress: () => {
          form.discard().catch((e: unknown) => {
            if (__DEV__) console.warn("review discard failed", e);
            Alert.alert(t("common.error"));
          });
        },
      },
    ]);

  const hasPages = form.pages.length > 0;
  const sideBySide = windowClass !== "compact";
  const errorCount = Object.values(form.errors).filter(Boolean).length;

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text }]}>
          {t(editing ? "review.editTitle" : "review.title")}
        </Text>
        {queue.length > 0 ? (
          <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{t("review.queued", { n: queue.length })}</Text>
        ) : null}
      </View>
      {editing ? null : (
        // Keeps the draft (edits are already written); "Continue reviewing" on Receipts reopens it.
        <Button variant="quiet" label={t("review.later")} onPress={() => router.back()} />
      )}
    </View>
  );

  const footer = (
    <View
      style={{
        flexDirection: "row",
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.md,
        paddingBottom: insets.bottom + theme.spacing.md,
        borderTopWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <Button
        tone={editing ? "default" : "danger"}
        label={t(editing ? "common.cancel" : "review.discard")}
        onPress={editing ? form.cancel : discard}
        disabled={form.busy}
        style={{ flex: 1 }}
      />
      <Button
        variant="primary"
        label={t("common.save")}
        accessibilityLabel={form.busy ? t("review.saving") : t("review.saveReceipt")}
        onPress={save}
        busy={form.busy}
        style={{ flex: 2 }}
      />
    </View>
  );

  const formScroll = (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", gap: theme.spacing.lg }}>
        {failed > 0 ? (
          <Text style={[theme.type.body, { color: theme.colors.danger }]}>
            {t("capture.failedSome", { failed, total: Number(params.total ?? failed) })}
          </Text>
        ) : null}
        {editing ? null : <DuplicateBanner duplicates={form.duplicates} onSaveAnyway={save} disabled={form.busy} />}
        {hasPages ? (
          // Inline viewer for compact; kept mounted (hidden) side by side, where the pane viewer shows.
          <View style={sideBySide ? { display: "none" } : undefined} {...(sideBySide ? hiddenView : null)}>
            <PageViewer pages={form.pages} />
          </View>
        ) : null}
        <ReviewFields form={form} categories={categories} />
        {errorCount > 0 ? (
          <Text accessibilityLiveRegion="polite" style={[theme.type.body, { color: theme.colors.danger }]}>
            {t("review.fixErrors")}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>{header}</View>
      <View style={{ flex: 1 }}>
        {/* `pages` is read once per screen, so this branch never flips on a fold. */}
        {hasPages ? (
          <TwoPane
            primary={
              <View style={{ flex: 1, padding: theme.spacing.lg }}>
                <PageViewer pages={form.pages} fill />
              </View>
            }
            secondary={formScroll}
          />
        ) : (
          formScroll
        )}
      </View>
      {footer}
    </KeyboardAvoidingView>
  );
}
