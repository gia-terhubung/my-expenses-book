import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import {
  KEYBOARD_SCROLL_PROPS,
  useKeyboardForm,
} from "@/layout/keyboardScroll";
import { Button } from "@/components/Button";
import { useDb } from "@/db/DatabaseProvider";
import { listCategories } from "@/db/repositories/categories";
import { TwoPane } from "@/layout/TwoPane";
import { useKeyboardVisible } from "@/layout/useKeyboardVisible";
import { useLayout } from "@/layout/useLayout";
import { useSheetTopInset } from "@/layout/useSheetTopInset";
import { useTheme } from "@/theme/ThemeProvider";

import { DuplicateBanner } from "./DuplicateBanner";
import { PageViewer } from "./PageViewer";
import { ReviewFields } from "./ReviewFields";
import {
  goNext,
  ReviewValidationError,
  useReviewForm,
  type ReviewFormMode,
} from "./useReviewForm";

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
 * The tree is the same for every layout (fold/rotate): the fields and both page viewers
 * keep their positions and only change style, so typed values, focus and decrypted views survive.
 * With pages, TwoPane holds a full-height viewer (shown side by side) and the form; compact hides
 * the viewer pane and shows an inline viewer inside the form instead.
 */
export function ReceiptFormScreen({ mode }: { mode: ReviewFormMode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { scrollProps: keyboardScroll, bottomRoom } = useKeyboardForm();
  const insets = useSafeAreaInsets();
  const sheetTop = useSheetTopInset();
  const keyboardVisible = useKeyboardVisible();
  const db = useDb();
  const { split } = useLayout();
  const params = useLocalSearchParams<{
    id: string;
    queue?: string;
    failed?: string;
    total?: string;
  }>();
  const editing = mode === "edit";
  const queue = useMemo(
    () =>
      !editing && params.queue ? params.queue.split(",").filter(Boolean) : [],
    [editing, params.queue],
  );
  // Above the TwoPane split, so the form state outlives any layout change.
  const form = useReviewForm(params.id, { queue, mode });
  const categories = useMemo(() => listCategories(db), [db]);
  const failed = editing ? 0 : Number(params.failed ?? 0);
  // One open page for both photo instances (inline and side pane), so a fold or rotation that
  // swaps them keeps the full-screen viewer open in the visible one.
  const [openPage, setOpenPage] = useState<number | null>(null);

  // Review: draft already saved or discarded (stale queue entry), move on. Edit: receipt gone or
  // not confirmed, close.
  useEffect(() => {
    if (form.receipt !== "missing") return;
    if (editing) router.back();
    else goNext(queue);
  }, [editing, form.receipt, queue]);

  if (form.receipt === "missing") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
        }}
      >
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
  const sideBySide = split;
  const errorCount = Object.values(form.errors).filter(Boolean).length;

  // iOS: native header (Later/Cancel left, Discard and Save right) instead of the in-page
  // header and the bottom bar, so on the iPhone Duo they move into the side column.
  const nativeHeader = Platform.OS === "ios";
  const title = t(editing ? "review.editTitle" : "review.title");
  // Owner 2026-11-26: create/edit pages get X (later/cancel) and checkmark (save) at the bottom of
  // the Duo column; Discard stays a trash icon at the top (review only).
  const nativeBars = nativeHeader ? (
    <>
      <Stack.Screen
        options={{ headerShown: true, title, headerBackVisible: false }}
      />
      {editing ? null : (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="trash"
            tintColor={theme.colors.danger}
            accessibilityLabel={t("review.discard")}
            onPress={discard}
            disabled={form.busy}
          >
            {t("review.discard")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      )}
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          icon="xmark"
          accessibilityLabel={t(editing ? "common.cancel" : "review.later")}
          onPress={editing ? form.cancel : () => router.back()}
          disabled={form.busy}
        >
          {t(editing ? "common.cancel" : "review.later")}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          icon="checkmark"
          variant="prominent"
          tintColor={theme.colors.primary}
          accessibilityLabel={
            form.busy ? t("review.saving") : t("review.saveReceipt")
          }
          onPress={save}
          disabled={form.busy}
        >
          {t("common.save")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  ) : null;

  const header = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        {nativeHeader ? null : (
          <Text
            accessibilityRole="header"
            style={[theme.type.title, { color: theme.colors.text }]}
          >
            {title}
          </Text>
        )}
        {form.receipt.recurringRuleId !== null ? (
          <Text
            testID="review-recurring-label"
            style={[
              theme.type.caption,
              { color: theme.colors.primary, fontWeight: "600" },
            ]}
          >
            {t("recurring.title")}
          </Text>
        ) : null}
        {queue.length > 0 ? (
          <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>
            {t("review.queued", { n: queue.length })}
          </Text>
        ) : null}
      </View>
      {editing || nativeHeader ? null : (
        // Keeps the draft (edits are already written); "Continue reviewing" on Receipts reopens it.
        <Button
          variant="quiet"
          label={t("review.later")}
          onPress={() => router.back()}
        />
      )}
    </View>
  );

  const footer = (
    <View
      testID="form-footer"
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
        accessibilityLabel={
          form.busy ? t("review.saving") : t("review.saveReceipt")
        }
        onPress={save}
        busy={form.busy}
        style={{ flex: 2 }}
      />
    </View>
  );

  const formScroll = (
    <ScrollView
      {...KEYBOARD_SCROLL_PROPS}
      {...keyboardScroll}
      // The bar is hidden while typing: dragging the form puts the keyboard away and brings it back.
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      contentContainerStyle={{
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.lg + bottomRoom,
        gap: theme.spacing.lg,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 640,
          alignSelf: "center",
          gap: theme.spacing.lg,
        }}
      >
        {failed > 0 ? (
          <Text style={[theme.type.body, { color: theme.colors.danger }]}>
            {t("capture.failedSome", {
              failed,
              total: Number(params.total ?? failed),
            })}
          </Text>
        ) : null}
        {editing ? null : (
          <DuplicateBanner
            duplicates={form.duplicates}
            onSaveAnyway={save}
            disabled={form.busy}
          />
        )}
        {hasPages ? (
          // Inline viewer for compact; kept mounted (hidden) side by side, where the pane viewer shows.
          <View
            style={sideBySide ? { display: "none" } : undefined}
            {...(sideBySide ? hiddenView : null)}
          >
            <PageViewer
              pages={form.pages}
              open={openPage}
              onOpenChange={setOpenPage}
              active={!sideBySide}
            />
          </View>
        ) : null}
        <ReviewFields form={form} categories={categories} />
        {errorCount > 0 ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[theme.type.body, { color: theme.colors.danger }]}
          >
            {t("review.fixErrors")}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      // iOS native header: the scroll view keeps clear of the keyboard itself (KEYBOARD_SCROLL_PROPS).
      behavior={Platform.OS === "ios" && !nativeHeader ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      {nativeBars}
      {/* Android shows (modals) full screen under the transparent status bar; iOS uses a page sheet. */}
      <View
        testID="form-header"
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: nativeHeader
            ? theme.spacing.sm
            : sheetTop + theme.spacing.lg,
        }}
      >
        {header}
      </View>
      <View style={{ flex: 1 }}>
        {/* `pages` is read once per screen, so this branch never flips on a fold. */}
        {hasPages ? (
          <TwoPane
            primary={
              <View style={{ flex: 1, padding: theme.spacing.lg }}>
                <PageViewer
                  pages={form.pages}
                  fill
                  open={openPage}
                  onOpenChange={setOpenPage}
                  active={sideBySide}
                />
              </View>
            }
            secondary={formScroll}
          />
        ) : (
          formScroll
        )}
      </View>
      {/* Hidden while the keyboard is up: lifted above it, the bar covered the focused field
          (a tap on Total hit Discard). */}
      {keyboardVisible || nativeHeader ? null : footer}
    </KeyboardAvoidingView>
  );
}
