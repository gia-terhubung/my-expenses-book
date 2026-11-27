import { useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import {
  KEYBOARD_SCROLL_PROPS,
  useKeyboardForm,
} from "@/layout/keyboardScroll";
import { deviceTimeZone } from "@/capture/localTime";
import { AppModal } from "@/components/AppModal";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateField";
import { DayGrid } from "@/components/DayGrid";
import { Input } from "@/components/Input";
import { now } from "@/dates/clock";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { listCategories } from "@/db/repositories/categories";
import { listFolders } from "@/db/repositories/folders";
import { getReceipt } from "@/db/repositories/receipts";
import type { RecurringFrequency } from "@/db/schema";
import type { AppDb, NewRecurringRuleInput, RecurringRule } from "@/db/types";
import { logError } from "@/errorLog/instance";
import { SHEET_CARD_MIN_CONTENT, SHEET_CARD_WIDTH } from "@/layout/layout";
import { useSideInsets } from "@/layout/SideSafeArea";
import { useLayout } from "@/layout/useLayout";
import { FolderPicker } from "@/organize/FolderPicker";
import { usePref } from "@/prefs/PrefsProvider";
import {
  amountText,
  isKnownCurrency,
  isValidDate,
  parseAmountInput,
} from "@/review/form";
import {
  CategoryChips,
  CurrencyField,
  FieldShell,
} from "@/review/ReviewFields";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SheetBar } from "@/layout/NativeSheet";
import { useTheme } from "@/theme/ThemeProvider";

import { deviceScheduler } from "./deviceScheduler";
import { shortDate, weekdayName } from "./format";
import { ensurePermissionForDraftRule } from "./notify";
import { todayIn } from "./occurrences";
import {
  createRule,
  createRuleFromReceipt,
  listRules,
  setPaused,
  softDeleteRule,
  updateRule,
} from "./rules";
import { requestCatchUp, rescheduleRecurring } from "./useRecurringCatchUp";

/** Editable rule fields, kept as typed. */
export type RuleFormValues = {
  merchant: string;
  /** Decimal as typed ("186.000", "12,50"). */
  amount: string;
  currency: string;
  categoryId: string | null;
  folderId: string | null;
  notes: string;
  frequency: RecurringFrequency;
  /** Monthly only: 1-28, or -1 for the last day. */
  monthDay: number;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD, or "" for no end. */
  endDate: string;
  autoAdd: boolean;
  paused: boolean;
  tz: string;
  /** Not editable here: carried over from the receipt or the rule. */
  taxMinor: number | null;
};

type RuleField = "amount" | "currency" | "monthDay" | "startDate" | "endDate";
/** Validation messages are i18n keys. */
export type RuleFormErrors = Partial<Record<RuleField, string>>;

const FREQUENCIES: RecurringFrequency[] = ["weekly", "monthly", "yearly"];

/** The monthly day a start date suggests: its own day, or "Last day" from the 29th on. */
const dayFor = (date: string) => {
  const d = Number(date.slice(8, 10));
  return d >= 1 && d <= 28 ? d : -1;
};

export function validateRuleValues(v: RuleFormValues): RuleFormErrors {
  const e: RuleFormErrors = {};
  if (!isKnownCurrency(v.currency))
    e.currency = "review.errors.currencyUnknown";
  else {
    const amount = parseAmountInput(v.amount, v.currency);
    if (v.amount.trim() === "") e.amount = "review.errors.totalRequired";
    else if (amount === null || amount <= 0)
      e.amount = "review.errors.totalInvalid";
  }
  if (
    v.frequency === "monthly" &&
    !(
      v.monthDay === -1 ||
      (Number.isInteger(v.monthDay) && v.monthDay >= 1 && v.monthDay <= 28)
    )
  ) {
    e.monthDay = "recurring.errors.dayInvalid";
  }
  if (v.startDate.trim() === "") e.startDate = "review.errors.dateRequired";
  else if (!isValidDate(v.startDate)) e.startDate = "review.errors.dateInvalid";
  if (v.endDate.trim() !== "") {
    if (!isValidDate(v.endDate)) e.endDate = "review.errors.dateInvalid";
    else if (isValidDate(v.startDate) && v.endDate < v.startDate)
      e.endDate = "recurring.errors.endBeforeStart";
  }
  return e;
}

/** Rule columns for valid values (see validateRuleValues). Pause is saved separately. */
export function ruleInputFrom(v: RuleFormValues): NewRecurringRuleInput {
  const currency = v.currency.toUpperCase();
  return {
    merchant: v.merchant.trim() || null,
    currency,
    totalMinor: parseAmountInput(v.amount, currency) ?? 0,
    taxMinor: v.taxMinor,
    categoryId: v.categoryId,
    folderId: v.folderId,
    notes: v.notes.trim() || null,
    frequency: v.frequency,
    anchorDate: v.startDate,
    monthDay: v.frequency === "monthly" ? v.monthDay : null,
    tz: v.tz,
    autoAdd: v.autoAdd,
    endDate: v.endDate.trim() || null,
  };
}

function valuesFromRule(r: RecurringRule, locale: string): RuleFormValues {
  return {
    merchant: r.merchant ?? "",
    amount: amountText(r.totalMinor, r.currency, locale),
    currency: r.currency,
    categoryId: r.categoryId,
    folderId: r.folderId,
    notes: r.notes ?? "",
    frequency: r.frequency,
    monthDay: r.monthDay ?? dayFor(r.anchorDate),
    startDate: r.anchorDate,
    endDate: r.endDate ?? "",
    autoAdd: r.autoAdd,
    paused: r.paused,
    tz: r.tz,
    taxMinor: r.taxMinor,
  };
}

/** Starting values: the rule being edited, the receipt being repeated, or a blank monthly rule. */
function initialValues(
  db: AppDb,
  ruleId: string | null,
  fromReceiptId: string | undefined,
  home: string,
  locale: string,
): RuleFormValues | "missing" {
  const tz = deviceTimeZone();
  if (ruleId) {
    const rule = listRules(db).find((r) => r.id === ruleId);
    return rule ? valuesFromRule(rule, locale) : "missing";
  }
  if (fromReceiptId) {
    const r = getReceipt(db, fromReceiptId);
    if (!r || r.deletedAt !== null) return "missing";
    const date = r.purchasedAtLocal.slice(0, 10);
    return {
      merchant: r.merchant ?? "",
      amount:
        r.totalMinor === 0 ? "" : amountText(r.totalMinor, r.currency, locale),
      currency: r.currency,
      categoryId: r.categoryId,
      folderId: r.folderId,
      notes: r.notes ?? "",
      frequency: "monthly",
      monthDay: dayFor(date),
      startDate: date,
      endDate: "",
      autoAdd: true,
      paused: false,
      tz,
      taxMinor: r.taxMinor,
    };
  }
  const today = todayIn(tz, now());
  return {
    merchant: "",
    amount: "",
    currency: home,
    categoryId: null,
    folderId: null,
    notes: "",
    frequency: "monthly",
    monthDay: dayFor(today),
    startDate: today,
    endDate: "",
    autoAdd: true,
    paused: false,
    tz,
    taxMinor: null,
  };
}

/**
 * After every rule write: ask for notification permission when a draft-type rule was saved,
 * re-plan the notifications and run catch-up (a rule due today adds today's expense). Never
 * throws: a refused or failing permission prompt never blocks the rule.
 */
async function afterRuleWrite(db: AppDb, draftRule: boolean): Promise<void> {
  if (draftRule) {
    try {
      await ensurePermissionForDraftRule(deviceScheduler);
    } catch (e) {
      logError("recurring", e);
    }
  }
  rescheduleRecurring(db);
  requestCatchUp();
}

type Props = {
  /** The rule to edit; null for a new one. */
  ruleId: string | null;
  /** "Repeat this…": prefill from this receipt and link it as the first occurrence. */
  fromReceiptId?: string;
  onSaved(rule: RecurringRule): void;
  onDeleted(): void;
  /** Shown as "‹ Back" when the form replaces the list (one pane). */
  onBack?: () => void;
  /** iOS: shown inside the Recurring page, which keeps the tab bar: X and ✓ go to the top of the column. */
  inPage?: boolean;
};

/**
 * Create or edit a recurring rule. Values live here (above any layout switch), so fold, unfold and
 * rotation keep what was typed. Save is the last control in the scroll view, never pinned.
 */
export function RuleForm({
  ruleId,
  fromReceiptId,
  onSaved,
  onDeleted,
  onBack,
  inPage = false,
}: Props) {
  // iOS: a create/edit page, so X and checkmark in the bottom toolbar, no tabs, no +.
  const nativeBar = Platform.OS === "ios";
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const { scrollProps: keyboardScroll, bottomRoom } = useKeyboardForm();
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const version = useDataVersion();
  const [initial] = useState(() =>
    initialValues(db, ruleId, fromReceiptId, home, locale),
  );
  const [values, setValues] = useState<RuleFormValues | null>(
    initial === "missing" ? null : initial,
  );
  const [errors, setErrors] = useState<RuleFormErrors>({});
  const [saveFailed, setSaveFailed] = useState<string | null>(null);
  const [folderOpen, setFolderOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const savedPaused = useRef(initial === "missing" ? false : initial.paused);
  // The values being written, set before the write so a second tap (before the re-render disables
  // the button) never writes twice: a duplicate rule, a receipt re-linked, onSaved/back() twice.
  // Cleared on failure; an edit after a save makes new values (the form stays open in split view).
  const savingRef = useRef<RuleFormValues | null>(null);
  const [savedValues, setSavedValues] = useState<RuleFormValues | null>(null);
  const deletingRef = useRef(false);
  const [deleted, setDeleted] = useState(false);
  const categories = useMemo(() => listCategories(db), [db]);
  // version: a folder created in the picker shows its name.
  const folderName = useMemo(
    () =>
      values?.folderId
        ? listFolders(db).find((f) => f.id === values.folderId)?.name
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, values?.folderId, version],
  );

  if (!values) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: theme.spacing.xl,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.md,
        }}
      >
        <ScreenHeader
          title={t("recurring.editTitle")}
          onBack={onBack ?? null}
        />
        <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
          {t("recurring.missing")}
        </Text>
      </View>
    );
  }

  const set = <K extends keyof RuleFormValues>(k: K, v: RuleFormValues[K]) => {
    setValues((cur) => (cur ? { ...cur, [k]: v } : cur));
    if (k in errors) setErrors((cur) => ({ ...cur, [k]: undefined }));
  };
  const device = deviceTimeZone();
  const errorCount = Object.values(errors).filter(Boolean).length;

  const save = () => {
    if (savingRef.current === values) return;
    const errs = validateRuleValues(values);
    setErrors(errs);
    const first = Object.values(errs).find(Boolean);
    if (first) {
      // Shown inline; announced too, since the first error may be off screen.
      AccessibilityInfo.announceForAccessibility(t(first));
      return;
    }
    let rule: RecurringRule;
    savingRef.current = values;
    try {
      const input = ruleInputFrom(values);
      const at = now();
      if (ruleId) {
        rule = updateRule(db, ruleId, input, at);
        if (values.paused !== savedPaused.current) {
          setPaused(db, ruleId, values.paused, at);
          savedPaused.current = values.paused;
          rule = { ...rule, paused: values.paused };
        }
      } else if (fromReceiptId) {
        rule = createRuleFromReceipt(db, fromReceiptId, input, at);
      } else {
        rule = createRule(db, input, at);
      }
    } catch (e) {
      logError("recurring", e);
      savingRef.current = null;
      setSaveFailed("recurring.saveFailed");
      return;
    }
    setSavedValues(values);
    setSaveFailed(null);
    void afterRuleWrite(db, !values.autoAdd);
    onSaved(rule);
  };

  const remove = () => {
    if (!ruleId || deletingRef.current) return;
    deletingRef.current = true;
    try {
      softDeleteRule(db, ruleId);
    } catch (e) {
      deletingRef.current = false;
      logError("recurring", e);
      setConfirmDelete(false);
      setSaveFailed("recurring.deleteFailed");
      return;
    }
    setDeleted(true);
    setConfirmDelete(false);
    void afterRuleWrite(db, false);
    onDeleted();
  };

  const input = (
    name: "merchant" | "amount" | "notes",
    label: string,
    props: TextInputProps = {},
  ) => {
    const error = name === "amount" ? errors.amount : undefined;
    return (
      <FieldShell label={label} hint={false} error={error}>
        <Input
          testID={`rule-${name}`}
          accessibilityLabel={label}
          accessibilityHint={error ? t(error) : undefined}
          flagColor={error ? theme.colors.danger : undefined}
          value={values[name]}
          onChangeText={(v) => set(name, v)}
          {...props}
          style={[
            theme.type.body,
            {
              minHeight: 48,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
            },
            props.multiline && { minHeight: 88, textAlignVertical: "top" },
          ]}
        />
      </FieldShell>
    );
  };

  const toggle = (
    label: string,
    value: boolean,
    onChange: (v: boolean) => void,
    help: string,
    testID: string,
  ) => (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 48,
          gap: theme.spacing.md,
        }}
      >
        <Text style={[theme.type.body, { color: theme.colors.text, flex: 1 }]}>
          {label}
        </Text>
        <Switch
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={help}
          value={value}
          onValueChange={onChange}
          trackColor={{ true: theme.colors.primary }}
        />
      </View>
      <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>
        {help}
      </Text>
    </View>
  );

  const readOnly = (text: string) => (
    <Text
      testID="rule-repeats-on"
      style={[theme.type.body, { color: theme.colors.text }]}
    >
      {text}
    </Text>
  );
  const validStart = isValidDate(values.startDate);

  return (
    <KeyboardAvoidingView
      // iOS: the scroll view keeps clear of the keyboard itself (KEYBOARD_SCROLL_PROPS).
      behavior={undefined}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <ScrollView
        testID="rule-form-scroll"
        {...KEYBOARD_SCROLL_PROPS}
        {...keyboardScroll}
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl + bottomRoom,
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
          {nativeBar ? (
            <SheetBar
              title={t(ruleId ? "recurring.editTitle" : "recurring.newTitle")}
              onCancel={onBack ?? undefined}
              onDone={save}
              doneLabel={t("common.save")}
              doneDisabled={savedValues === values}
              placement={inPage ? "top" : "bottom"}
            />
          ) : (
            <ScreenHeader
              title={t(ruleId ? "recurring.editTitle" : "recurring.newTitle")}
              onBack={onBack ?? null}
            />
          )}
          {input("merchant", t("review.merchant"), {
            autoCapitalize: "words",
            autoCorrect: false,
          })}
          <View
            style={{
              flexDirection: "row",
              gap: theme.spacing.md,
              flexWrap: "wrap",
            }}
          >
            <View style={{ flexGrow: 2, flexBasis: 160 }}>
              {input("amount", t("recurring.amount"), {
                keyboardType: "decimal-pad",
              })}
            </View>
            <View style={{ flexGrow: 1, flexBasis: 110 }}>
              <FieldShell
                label={t("review.currency")}
                hint={false}
                error={errors.currency}
              >
                <CurrencyField
                  label={t("review.currency")}
                  value={values.currency}
                  onChange={(c) => set("currency", c)}
                  flagColor={errors.currency ? theme.colors.danger : undefined}
                />
              </FieldShell>
            </View>
          </View>

          <FieldShell label={t("recurring.repeats")} hint={false}>
            <FrequencyControl
              value={values.frequency}
              onChange={(f) => set("frequency", f)}
            />
          </FieldShell>
          {values.frequency === "monthly" ? (
            <FieldShell
              label={t("recurring.onDay")}
              hint={false}
              error={errors.monthDay}
            >
              <DayGrid
                value={values.monthDay}
                onChange={(n) => set("monthDay", n)}
                allowLastDay
              />
            </FieldShell>
          ) : validStart ? (
            readOnly(
              values.frequency === "weekly"
                ? t("recurring.everyWeekday", {
                    weekday: weekdayName(values.startDate, locale),
                  })
                : t("recurring.everyDate", {
                    date: shortDate(values.startDate, locale),
                  }),
            )
          ) : null}

          <View
            style={{
              flexDirection: "row",
              gap: theme.spacing.md,
              flexWrap: "wrap",
            }}
          >
            <View style={{ flexGrow: 1, flexBasis: 160 }}>
              <DateField
                label={t("recurring.startDate")}
                value={values.startDate}
                onChange={(v) => set("startDate", v)}
                error={errors.startDate ? t(errors.startDate) : undefined}
                placeholder={t("review.datePlaceholder")}
                testID="rule-start"
              />
            </View>
            <View
              style={{ flexGrow: 1, flexBasis: 160, gap: theme.spacing.xs }}
            >
              <DateField
                label={t("recurring.endDate")}
                value={values.endDate}
                onChange={(v) => set("endDate", v)}
                error={errors.endDate ? t(errors.endDate) : undefined}
                placeholder={t("recurring.noEndDate")}
                testID="rule-end"
              />
              {values.endDate ? (
                <Button
                  variant="quiet"
                  label={t("recurring.removeEndDate")}
                  onPress={() => set("endDate", "")}
                />
              ) : null}
            </View>
          </View>

          {toggle(
            t("recurring.autoAdd"),
            values.autoAdd,
            (v) => set("autoAdd", v),
            t(values.autoAdd ? "recurring.autoAddOn" : "recurring.autoAddOff"),
            "rule-auto-add",
          )}
          {ruleId
            ? toggle(
                t("recurring.paused"),
                values.paused,
                (v) => set("paused", v),
                t("recurring.pausedHelp"),
                "rule-paused",
              )
            : null}

          <FieldShell label={t("review.category")} hint={false}>
            <CategoryChips
              categories={categories}
              value={values.categoryId}
              onChange={(id) => set("categoryId", id)}
            />
          </FieldShell>
          <FieldShell label={t("review.folder")} hint={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t("review.folder")} ${folderName ?? t("folders.none")}`}
              onPress={() => setFolderOpen(true)}
              style={({ pressed }) => ({
                minHeight: 48,
                justifyContent: "center",
                paddingHorizontal: theme.spacing.md,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: pressed
                  ? theme.colors.surfacePressed
                  : theme.colors.surface,
              })}
            >
              <Text
                style={[
                  theme.type.body,
                  {
                    color: folderName
                      ? theme.colors.text
                      : theme.colors.textMuted,
                  },
                ]}
              >
                {folderName ?? t("folders.none")}
              </Text>
            </Pressable>
          </FieldShell>
          {input("notes", t("review.notes"), {
            multiline: true,
            placeholder: t("review.optional"),
          })}

          {values.tz !== device ? (
            <View testID="rule-tz" style={{ gap: theme.spacing.xs }}>
              <Text
                style={[theme.type.body, { color: theme.colors.textMuted }]}
              >
                {t("recurring.timesIn", { tz: values.tz })}
              </Text>
              <Button
                variant="quiet"
                label={t("recurring.useDeviceTz")}
                onPress={() => set("tz", device)}
              />
            </View>
          ) : null}

          {errorCount > 0 ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[theme.type.body, { color: theme.colors.danger }]}
            >
              {t("review.fixErrors")}
            </Text>
          ) : null}
          {saveFailed ? (
            <Text
              accessibilityLiveRegion="polite"
              style={[theme.type.body, { color: theme.colors.danger }]}
            >
              {t(saveFailed)}
            </Text>
          ) : null}
          {nativeBar ? null : (
            <Button
              testID="rule-save"
              variant="primary"
              label={t("common.save")}
              onPress={save}
              disabled={savedValues === values}
            />
          )}
          {ruleId ? (
            <View
              style={{
                marginTop: theme.spacing.xl,
                paddingTop: theme.spacing.lg,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.border,
              }}
            >
              <Button
                testID="rule-delete"
                tone="danger"
                label={t("recurring.delete")}
                onPress={() => setConfirmDelete(true)}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
      <FolderPicker
        visible={folderOpen}
        value={values.folderId}
        onChange={(folderId) => {
          set("folderId", folderId);
          setFolderOpen(false);
        }}
        onClose={() => setFolderOpen(false)}
      />
      <ConfirmDeleteSheet
        visible={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={remove}
        disabled={deleted}
      />
    </KeyboardAvoidingView>
  );
}

/** Weekly / Monthly / Yearly as three tonal choices, styled like the day grid's cells. */
function FrequencyControl({
  value,
  onChange,
}: {
  value: RecurringFrequency;
  onChange(f: RecurringFrequency): void;
}) {
  const { t } = useTranslation();
  const { colors, type, spacing, radius } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: "row", gap: spacing.xs }}
    >
      {FREQUENCIES.map((f) => {
        const selected = f === value;
        return (
          <Pressable
            key={f}
            testID={`rule-frequency-${f}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(f)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing.sm,
              borderRadius: radius.control,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected
                ? colors.tonal
                : pressed
                  ? colors.tonalPressed
                  : colors.surface,
            })}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[
                type.label,
                { color: selected ? colors.primary : colors.text },
              ]}
            >
              {t(`recurring.${f}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet to confirm deleting a rule (no system alert), laid out like the add sheet. */
function ConfirmDeleteSheet({
  visible,
  onCancel,
  onConfirm,
  disabled,
}: {
  visible: boolean;
  onCancel(): void;
  onConfirm(): void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const side = useSideInsets();
  const layout = useLayout();
  return (
    <AppModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.cancel")}
          onPress={onCancel}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        />
        <View style={{ paddingLeft: side.left, paddingRight: side.right }}>
          <View
            testID="rule-delete-sheet"
            style={{
              width: "100%",
              maxWidth:
                layout.content >= SHEET_CARD_MIN_CONTENT
                  ? SHEET_CARD_WIDTH
                  : "100%",
              alignSelf: "center",
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.sheet,
              borderTopRightRadius: theme.radius.sheet,
              borderCurve: "continuous",
              boxShadow: theme.elevation.sheet,
              padding: theme.spacing.lg,
              paddingBottom: insets.bottom + theme.spacing.lg,
              gap: theme.spacing.md,
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.border,
              }}
            />
            <Text
              accessibilityRole="header"
              style={[theme.type.title, { color: theme.colors.text }]}
            >
              {t("recurring.deleteTitle")}
            </Text>
            <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
              {t("recurring.deleteMessage")}
            </Text>
            <Button
              testID="rule-delete-confirm"
              tone="danger"
              label={t("common.delete")}
              onPress={onConfirm}
              disabled={disabled}
            />
            <Button
              variant="quiet"
              tone="muted"
              align="center"
              label={t("common.cancel")}
              onPress={onCancel}
            />
          </View>
        </View>
      </View>
    </AppModal>
  );
}
