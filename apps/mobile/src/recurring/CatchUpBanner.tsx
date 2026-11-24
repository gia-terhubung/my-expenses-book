import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { openReview } from "@/capture/useAddReceipt";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useDb } from "@/db/DatabaseProvider";
import { getReceipt } from "@/db/repositories/receipts";
import { useTheme } from "@/theme/ThemeProvider";
import type { ColorTokens } from "@/theme/tokens";

import { undoCatchUp } from "./catchUp";
import { useCatchUpResult } from "./useRecurringCatchUp";

/** How long "Removed 3 recurring expenses." stays after Undo. */
export const REMOVED_MS = 4000;

/** Banner text colours on the card's surface (checked by the contrast test). */
export const CATCH_UP_BANNER_TEXT: [keyof ColorTokens, keyof ColorTokens][] = [
  ["text", "surface"],
  ["textMuted", "surface"],
  ["primary", "surface"],
  ["primary", "tonal"],
];

/**
 * Home, under the slip: what the last catch-up runs added, with Review (opens the first draft
 * they created, the rest queued) and Undo (removes the rows they added that are still untouched).
 * No animation.
 */
export function CatchUpBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useDb();
  const { last, dismiss } = useCatchUpResult();
  const [removed, setRemoved] = useState<{ count: number; kept: boolean } | null>(null);

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), REMOVED_MS);
    return () => clearTimeout(timer);
  }, [removed]);

  const shell = (children: React.ReactNode) => (
    <Card
      testID="catch-up-banner"
      style={{ flexDirection: "column", alignItems: "stretch", marginHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.md, gap: theme.spacing.sm }}
    >
      {children}
    </Card>
  );

  if (removed) {
    return shell(
      <Text accessibilityLiveRegion="polite" style={[theme.type.body, { color: theme.colors.text }]}>
        {t("recurring.removed", { count: removed.count })}
        {removed.kept ? ` ${t("recurring.undoKept")}` : ""}
      </Text>,
    );
  }
  if (!last || last.createdIds.length === 0) return null;

  const count = last.createdIds.length;
  const review = () => {
    // Drafts of this run still waiting, in the order they were created.
    const drafts = last.createdIds.filter((id) => {
      const r = getReceipt(db, id);
      return r !== null && r.deletedAt === null && r.status === "draft";
    });
    if (drafts.length > 0) openReview(drafts);
  };
  const undo = () => {
    const n = undoCatchUp(db, last.createdIds);
    dismiss();
    setRemoved({ count: n, kept: n < count });
  };

  return shell(
    <>
      <View accessible accessibilityLiveRegion="polite">
        <Text style={[theme.type.body, { color: theme.colors.text, fontWeight: "600" }]}>{t("recurring.added", { count })}</Text>
        {last.draftCount > 0 ? (
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("recurring.needConfirm", { count: last.draftCount })}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing.lg }}>
        {last.draftCount > 0 ? <Button testID="catch-up-review" variant="highlight" label={t("recurring.review")} onPress={review} /> : null}
        <View style={{ flex: 1 }} />
        <Button testID="catch-up-undo" variant="quiet" label={t("recurring.undo")} onPress={undo} />
        <Button testID="catch-up-dismiss" variant="quiet" tone="muted" label={t("recurring.dismiss")} onPress={dismiss} />
      </View>
    </>,
  );
}
