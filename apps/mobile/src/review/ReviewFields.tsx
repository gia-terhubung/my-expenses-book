import { useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/AppModal";
import { DateField } from "@/components/DateField";
import { CurrencyPicker, currencyName } from "@/components/CurrencyPicker";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { listFolders } from "@/db/repositories/folders";
import type { Category } from "@/db/types";
import { formatMoney } from "@/money/money";
import { categoryLabel } from "@/organize/categoryLabel";
import { FolderPicker } from "@/organize/FolderPicker";
import type { FieldConfidence } from "@/parsing/types";
import { useTheme } from "@/theme/ThemeProvider";

import { CONFIDENCE_OF, type ReviewField } from "./form";
import type { ReviewForm } from "./useReviewForm";

// Re-exported for existing callers; the pure function lives in organize/categoryLabel.
export { categoryLabel };

function FieldShell({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint: boolean;
  error?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
        <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{label}</Text>
        {hint ? (
          <Text style={[theme.type.caption, { color: theme.colors.warning, fontWeight: "600" }]}>{t("review.checkThis")}</Text>
        ) : null}
      </View>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[theme.type.caption, { color: theme.colors.danger }]}>
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Review form body: merchant, date, time, total, currency, tax, category (incl. Transfer),
 * folder, notes, plus the home-currency preview and manual rate for foreign receipts. Low-confidence
 * fields get a highlighted border and a "Check this" hint (not for empty optional tax/category).
 */
export function ReviewFields({ form, categories }: { form: ReviewForm; categories: Category[] }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const { values, setField, errors, lowConfidence, fx, home } = form;
  const db = useDb();
  const version = useDataVersion();
  // version: a folder created or renamed elsewhere (or in the picker) shows its current name.
  const folderName = useMemo(
    () => (values.folderId ? listFolders(db).find((f) => f.id === values.folderId)?.name : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, values.folderId, version],
  );

  const isLow = (name: ReviewField) => {
    const c = CONFIDENCE_OF[name] as keyof FieldConfidence | undefined;
    if (!c || !lowConfidence.has(c)) return false;
    if (name === "tax" && !values.tax.trim()) return false;
    if (name === "categoryId" && !values.categoryId) return false;
    return true;
  };

  const borderFor = (name: ReviewField) =>
    errors[name] ? theme.colors.danger : isLow(name) ? theme.colors.warning : theme.colors.border;

  const input = (name: ReviewField, label: string, props: TextInputProps = {}) => (
    <FieldShell label={label} hint={isLow(name)} error={errors[name]}>
      <TextInput
        accessibilityLabel={label}
        // Screen readers hear the error and the "Check this" flag with the field, not only nearby.
        accessibilityHint={[errors[name] ? t(errors[name]) : null, isLow(name) ? t("review.checkThis") : null].filter(Boolean).join(". ") || undefined}
        value={(values[name] as string) ?? ""}
        onChangeText={(v) => setField(name, v)}
        editable={!form.busy}
        placeholderTextColor={theme.colors.textMuted}
        {...props}
        style={[
          theme.type.body,
          {
            minHeight: 48,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radius.md,
            borderWidth: isLow(name) || errors[name] ? 2 : 1,
            borderColor: borderFor(name),
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
          },
          props.multiline && { minHeight: 88, textAlignVertical: "top" },
        ]}
      />
    </FieldShell>
  );

  const money = (minor: number, code: string) => {
    try {
      return formatMoney(minor, code, i18n.language);
    } catch {
      return code;
    }
  };

  const foreign = values.currency && values.currency.toUpperCase() !== home.toUpperCase();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {input("merchant", t("review.merchant"), { autoCapitalize: "words", autoCorrect: false })}
      <View style={{ flexDirection: "row", gap: theme.spacing.md, flexWrap: "wrap" }}>
        <View style={{ flexGrow: 2, flexBasis: 160 }}>
          <DateField
            label={t("review.date")}
            value={values.date}
            onChange={(v) => setField("date", v)}
            error={errors.date ? t(errors.date) : undefined}
            hint={isLow("date") ? t("review.checkThis") : undefined}
            placeholder={t("review.datePlaceholder")}
            disabled={form.busy}
            testID="review-date"
          />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 110 }}>
          {input("time", t("review.time"), { placeholder: t("review.timePlaceholder"), keyboardType: "numbers-and-punctuation", maxLength: 5 })}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: theme.spacing.md, flexWrap: "wrap" }}>
        <View style={{ flexGrow: 2, flexBasis: 160 }}>{input("total", t("review.total"), { keyboardType: "decimal-pad" })}</View>
        <View style={{ flexGrow: 1, flexBasis: 110 }}>
          <FieldShell label={t("review.currency")} hint={isLow("currency")} error={errors.currency}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t("review.currency")} ${values.currency ? currencyName(i18n.language, values.currency) : ""}`.trim()}
              disabled={form.busy}
              onPress={() => setCurrencyOpen(true)}
              style={{
                minHeight: 48,
                justifyContent: "center",
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.md,
                borderWidth: isLow("currency") || errors.currency ? 2 : 1,
                borderColor: borderFor("currency"),
                backgroundColor: theme.colors.surface,
              }}
            >
              <Text style={[theme.type.body, { color: theme.colors.text, fontWeight: "600" }]}>{values.currency || "—"}</Text>
            </Pressable>
          </FieldShell>
        </View>
      </View>

      {foreign ? (
        <View style={{ gap: theme.spacing.sm }}>
          {fx ? (
            <Text style={[theme.type.body, { color: theme.colors.text }]}>
              {t("review.approx", { amount: money(fx.conversion.amountHomeMinor, home) })}
              {fx.conversion.approximate ? (
                <Text style={{ color: theme.colors.textMuted }}>{`  ${t("review.approxRate")}`}</Text>
              ) : null}
            </Text>
          ) : (
            <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("review.noRate")}</Text>
          )}
          {input("fxRate", t("review.rateLabel", { from: values.currency, to: home }), {
            keyboardType: "decimal-pad",
            placeholder: t("review.ratePlaceholder"),
          })}
        </View>
      ) : null}

      {input("tax", t("review.tax"), { keyboardType: "decimal-pad", placeholder: t("review.optional") })}

      <FieldShell label={t("review.category")} hint={isLow("categoryId")} error={errors.categoryId}>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {[null, ...categories].map((c) => {
            const id = c?.id ?? null;
            const selected = values.categoryId === id;
            const label = c ? categoryLabel(c, t) : t("review.noCategory");
            return (
              <Pressable
                key={id ?? "none"}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                disabled={form.busy}
                onPress={() => setField("categoryId", id)}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.pill,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? theme.colors.primary : isLow("categoryId") ? theme.colors.warning : theme.colors.border,
                  backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                }}
              >
                <Text style={[theme.type.body, { color: selected ? theme.colors.onPrimary : theme.colors.text }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </FieldShell>

      <FieldShell label={t("review.folder")} hint={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("review.folder")} ${folderName ?? t("folders.none")}`}
          disabled={form.busy}
          onPress={() => setFolderOpen(true)}
          style={{
            minHeight: 48,
            justifyContent: "center",
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Text style={[theme.type.body, { color: folderName ? theme.colors.text : theme.colors.textMuted }]}>
            {folderName ?? t("folders.none")}
          </Text>
        </Pressable>
      </FieldShell>
      <FolderPicker
        visible={folderOpen}
        value={values.folderId}
        onChange={(folderId) => {
          setField("folderId", folderId);
          setFolderOpen(false);
        }}
        onClose={() => setFolderOpen(false)}
      />

      {input("notes", t("review.notes"), { multiline: true, placeholder: t("review.optional") })}

      {currencyOpen ? (
        <AppModal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCurrencyOpen(false)}>
          <View
            style={{
              flex: 1,
              backgroundColor: theme.colors.background,
              padding: theme.spacing.xl,
              paddingBottom: insets.bottom + theme.spacing.xl,
              gap: theme.spacing.lg,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text, flexShrink: 1 }]}>
                {t("review.currency")}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setCurrencyOpen(false)} style={{ minHeight: 48, justifyContent: "center" }}>
                <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{t("common.done")}</Text>
              </Pressable>
            </View>
            <CurrencyPicker
              lang={i18n.language}
              value={values.currency}
              onChange={(c) => {
                setField("currency", c);
                setCurrencyOpen(false);
              }}
            />
          </View>
        </AppModal>
      ) : null}
    </View>
  );
}
