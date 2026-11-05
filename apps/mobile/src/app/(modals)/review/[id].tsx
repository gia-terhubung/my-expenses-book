import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, type ReactNode } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useDb } from "@/db/DatabaseProvider";
import { listCategories } from "@/db/repositories/categories";
import { TwoPane } from "@/layout/TwoPane";
import { useWindowClass } from "@/layout/useWindowClass";
import { DuplicateBanner } from "@/review/DuplicateBanner";
import { PageViewer } from "@/review/PageViewer";
import { ReviewFields } from "@/review/ReviewFields";
import { goNext, ReviewValidationError, useReviewForm } from "@/review/useReviewForm";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Draft review: photo + parsed fields to confirm. `queue` = comma-separated draft ids still to
 * review after this one; `failed`/`total` = photos the capture run couldn't save (shown once).
 */
export default function ReviewScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const windowClass = useWindowClass();
  const params = useLocalSearchParams<{ id: string; queue?: string; failed?: string; total?: string }>();
  const queue = useMemo(() => (params.queue ? params.queue.split(",").filter(Boolean) : []), [params.queue]);
  const form = useReviewForm(params.id, { queue });
  const categories = useMemo(() => listCategories(db), [db]);
  const failed = Number(params.failed ?? 0);

  // Draft already saved or discarded (stale queue entry): move on.
  useEffect(() => {
    if (form.receipt === "missing") goNext(queue);
  }, [form.receipt, queue]);

  if (form.receipt === "missing") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const save = () => {
    form.save().catch((e: unknown) => {
      if (e instanceof ReviewValidationError) return; // shown inline
      if (__DEV__) console.warn("review save failed", e);
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
  const sideBySide = hasPages && windowClass !== "compact";
  const errorCount = Object.values(form.errors).filter(Boolean).length;

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text }]}>
          {t("review.title")}
        </Text>
        {queue.length > 0 ? (
          <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{t("review.queued", { n: queue.length })}</Text>
        ) : null}
      </View>
      {/* Keeps the draft (edits are already written); "Continue reviewing" on Receipts reopens it. */}
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 48, justifyContent: "center" }}>
        <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{t("review.later")}</Text>
      </Pressable>
    </View>
  );

  const notices: ReactNode = (
    <>
      {failed > 0 ? (
        <Text style={[theme.type.body, { color: theme.colors.danger }]}>
          {t("capture.failedSome", { failed, total: Number(params.total ?? failed) })}
        </Text>
      ) : null}
      <DuplicateBanner duplicates={form.duplicates} onSaveAnyway={save} disabled={form.busy} />
    </>
  );

  const fields = <ReviewFields form={form} categories={categories} />;

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
      <Pressable
        accessibilityRole="button"
        onPress={discard}
        disabled={form.busy}
        style={{ minHeight: 48, flex: 1, justifyContent: "center", alignItems: "center", borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border }}
      >
        <Text style={[theme.type.body, { color: theme.colors.danger, fontWeight: "600" }]}>{t("review.discard")}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: form.busy }}
        onPress={save}
        disabled={form.busy}
        style={{ minHeight: 48, flex: 2, justifyContent: "center", alignItems: "center", borderRadius: theme.radius.md, backgroundColor: theme.colors.primary }}
      >
        {form.busy ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Text style={[theme.type.body, { color: theme.colors.onPrimary, fontWeight: "600" }]}>{t("common.save")}</Text>
        )}
      </Pressable>
    </View>
  );

  const scroll = (children: ReactNode) => (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
      <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", gap: theme.spacing.lg }}>
        {children}
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
        {sideBySide ? (
          <TwoPane
            primary={
              <View style={{ flex: 1, padding: theme.spacing.lg }}>
                <PageViewer pages={form.pages} fill />
              </View>
            }
            secondary={scroll(
              <>
                {notices}
                {fields}
              </>,
            )}
          />
        ) : (
          scroll(
            <>
              {notices}
              {hasPages ? <PageViewer pages={form.pages} /> : null}
              {fields}
            </>,
          )
        )}
      </View>
      {footer}
    </KeyboardAvoidingView>
  );
}
