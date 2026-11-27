import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createFolder } from "@/db/repositories/folders";
import { createReceipt, getReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb, NewRecurringRuleInput } from "@/db/types";
import { initI18n } from "@/i18n";

import { ensurePermissionForDraftRule, rescheduleAll } from "./notify";
import { createRule, listRules, softDeleteRule } from "./rules";
import { RuleForm, validateRuleValues, type RuleFormValues } from "./RuleForm";
import { useAndroidPlatform } from "../../test/androidPlatform";

// Native header and sheet toolbars render as plain views; router calls are recorded.
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock,
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ addListener: () => () => {}, setOptions: jest.fn() }),
  usePreventRemove: jest.fn(),
}));

let mockDb: AppDb;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => (k === "homeCurrency" ? "IDR" : undefined),
  usePrefs: () => ({ get: () => ({ base: "idr", latestDate: null, fetchedAt: null, byDate: {} }) }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// The typed-text field (the iOS file wraps a native SwiftUI picker).
jest.mock("@/components/DateField", () => ({ DateField: jest.requireActual("@/components/DateFieldText").DateFieldText }));
jest.mock("@/dates/clock", () => ({
  ...jest.requireActual("@/dates/clock"),
  now: () => new Date("2026-11-20T05:00:00Z"),
}));
jest.mock("./deviceScheduler", () => ({ deviceScheduler: { name: "device" } }));
jest.mock("./notify", () => ({
  ensurePermissionForDraftRule: jest.fn(async () => true),
  rescheduleAll: jest.fn(async () => 0),
}));

const ensure = ensurePermissionForDraftRule as jest.Mock;
const reschedule = rescheduleAll as jest.Mock;
// test/globalTz.js pins the device zone.
const DEVICE_TZ = "Europe/Paris";

function seedReceipt() {
  const folder = createFolder(mockDb, { name: "Home", kind: "project" });
  const r = createReceipt(mockDb, {
    status: "confirmed",
    merchant: "Netflix",
    purchasedAtLocal: "2026-11-03T10:15:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 10, 3, 3, 15),
    scannedAtUtc: Date.UTC(2026, 10, 3, 3, 15),
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: 18600000,
    taxMinor: null,
    categoryId: "default:entertainment",
    folderId: folder.id,
    notes: "Family plan",
    parseSource: "manual",
  });
  return { receipt: r, folder };
}

function rule(over: Partial<NewRecurringRuleInput> = {}) {
  return createRule(
    mockDb,
    {
      merchant: "Rent",
      currency: "IDR",
      totalMinor: 350000000,
      taxMinor: null,
      categoryId: null,
      folderId: null,
      notes: null,
      frequency: "monthly",
      anchorDate: "2026-11-01",
      monthDay: 1,
      tz: DEVICE_TZ,
      autoAdd: true,
      endDate: null,
      ...over,
    },
    new Date("2026-11-20T05:00:00Z"),
  );
}

const values = (over: Partial<RuleFormValues> = {}): RuleFormValues => ({
  merchant: "Rent",
  amount: "3.500.000",
  currency: "IDR",
  categoryId: null,
  folderId: null,
  notes: "",
  frequency: "monthly",
  monthDay: 1,
  startDate: "2026-11-01",
  endDate: "",
  autoAdd: true,
  paused: false,
  tz: DEVICE_TZ,
  taxMinor: null,
  ...over,
});

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  jest.clearAllMocks();
});

const noop = () => {};

/**
 * Two taps before React re-renders, so the second lands before Save is disabled: Pressability's
 * click handler (an accessibility activation) called twice in one act.
 */
async function pressTwice(el: ReturnType<typeof screen.getByTestId>) {
  const click = el.props.onClick as (e: { nativeEvent: object }) => void;
  await act(async () => {
    click({ nativeEvent: {} });
    click({ nativeEvent: {} });
  });
}

// The in-page header and footer are Android's; iOS uses the native header (ScreenHeader.test).
useAndroidPlatform();

describe("RuleForm", () => {
  it("'Repeat this…' prefills merchant, amount, currency, category, folder, notes and the receipt's date", async () => {
    const { receipt, folder } = seedReceipt();
    await render(<RuleForm ruleId={null} fromReceiptId={receipt.id} onSaved={noop} onDeleted={noop} />);
    expect(screen.getByTestId("rule-merchant").props.value).toBe("Netflix");
    expect(screen.getByTestId("rule-amount").props.value).toBe("186000");
    expect(screen.getByLabelText("Currency Indonesian Rupiah")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Entertainment" }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText(`Folder ${folder.name}`)).toBeTruthy();
    expect(screen.getByTestId("rule-notes").props.value).toBe("Family plan");
    expect(screen.getByTestId("rule-start").props.value).toBe("2026-11-03");
    // Monthly on the receipt's day.
    expect(screen.getByRole("radio", { name: "Day 3" }).props.accessibilityState.checked).toBe(true);
  });

  it("saving from a receipt creates the rule with createRuleFromReceipt (the receipt is linked)", async () => {
    const { receipt } = seedReceipt();
    const onSaved = jest.fn();
    await render(<RuleForm ruleId={null} fromReceiptId={receipt.id} onSaved={onSaved} onDeleted={noop} />);
    await fireEvent.press(screen.getByTestId("rule-save"));
    const [saved] = listRules(mockDb);
    expect(saved).toMatchObject({ merchant: "Netflix", totalMinor: 18600000, frequency: "monthly", monthDay: 3, anchorDate: "2026-11-03" });
    expect(getReceipt(mockDb, receipt.id)).toMatchObject({ recurringRuleId: saved.id, recurringDate: "2026-11-03" });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: saved.id }));
    await waitFor(() => expect(reschedule).toHaveBeenCalledTimes(1));
  });

  it("validates amount, currency, day and end date", () => {
    expect(validateRuleValues(values())).toEqual({});
    expect(validateRuleValues(values({ amount: "0" })).amount).toBe("review.errors.totalInvalid");
    expect(validateRuleValues(values({ amount: "" })).amount).toBe("review.errors.totalRequired");
    expect(validateRuleValues(values({ currency: "XXQ" })).currency).toBe("review.errors.currencyUnknown");
    expect(validateRuleValues(values({ monthDay: 29 })).monthDay).toBe("recurring.errors.dayInvalid");
    expect(validateRuleValues(values({ monthDay: 0 })).monthDay).toBe("recurring.errors.dayInvalid");
    expect(validateRuleValues(values({ monthDay: -1 }))).toEqual({});
    expect(validateRuleValues(values({ monthDay: 29, frequency: "weekly" }))).toEqual({});
    expect(validateRuleValues(values({ endDate: "2026-10-31" })).endDate).toBe("recurring.errors.endBeforeStart");
    expect(validateRuleValues(values({ endDate: "2026-11-01" }))).toEqual({});
    expect(validateRuleValues(values({ startDate: "2026-13-01" })).startDate).toBe("review.errors.dateInvalid");
  });

  it("shows what is wrong and how to fix it, and saves nothing", async () => {
    const onSaved = jest.fn();
    await render(<RuleForm ruleId={null} onSaved={onSaved} onDeleted={noop} />);
    await fireEvent.changeText(screen.getByTestId("rule-amount"), "0");
    await fireEvent.changeText(screen.getByTestId("rule-end"), "2026-01-01");
    await fireEvent.press(screen.getByTestId("rule-save"));
    expect(screen.getByText("Enter a valid amount above zero.")).toBeTruthy();
    expect(screen.getByText("The end date is before the start date. Pick a later date or remove it.")).toBeTruthy();
    expect(screen.getByText("Check the highlighted fields.")).toBeTruthy();
    expect(listRules(mockDb)).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("turning Add automatically off and saving asks for notification permission once", async () => {
    await render(<RuleForm ruleId={null} onSaved={noop} onDeleted={noop} />);
    await fireEvent.changeText(screen.getByTestId("rule-merchant"), "Electricity");
    await fireEvent.changeText(screen.getByTestId("rule-amount"), "250.000");
    await fireEvent(screen.getByTestId("rule-auto-add"), "valueChange", false);
    expect(screen.getByText("Added as a draft for you to confirm, with a reminder at 9:00.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("rule-save"));
    expect(listRules(mockDb)[0]).toMatchObject({ merchant: "Electricity", totalMinor: 25000000, autoAdd: false, tz: DEVICE_TZ });
    await waitFor(() => expect(reschedule).toHaveBeenCalledTimes(1));
    expect(ensure).toHaveBeenCalledTimes(1);
    expect(ensure).toHaveBeenCalledWith({ name: "device" });
  });

  it("a failing permission prompt never blocks the save", async () => {
    ensure.mockRejectedValueOnce(new Error("no channel"));
    const onSaved = jest.fn();
    await render(<RuleForm ruleId={null} onSaved={onSaved} onDeleted={noop} />);
    await fireEvent.changeText(screen.getByTestId("rule-amount"), "250.000");
    await fireEvent(screen.getByTestId("rule-auto-add"), "valueChange", false);
    await fireEvent.press(screen.getByTestId("rule-save"));
    expect(onSaved).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(reschedule).toHaveBeenCalledTimes(1));
  });

  it("a rule kept in another zone says so and offers the current zone", async () => {
    const r = rule({ tz: "Asia/Jakarta" });
    await render(<RuleForm ruleId={r.id} onSaved={noop} onDeleted={noop} />);
    expect(screen.getByText("Times in Asia/Jakarta")).toBeTruthy();
    await fireEvent.press(screen.getByText("Use my current time zone"));
    expect(screen.queryByText("Times in Asia/Jakarta")).toBeNull();
    await fireEvent.press(screen.getByTestId("rule-save"));
    expect(listRules(mockDb)[0].tz).toBe(DEVICE_TZ);
  });

  it("no zone note when the rule's zone is the device's", async () => {
    const r = rule();
    await render(<RuleForm ruleId={r.id} onSaved={noop} onDeleted={noop} />);
    expect(screen.queryByTestId("rule-tz")).toBeNull();
  });

  it("weekly and yearly show the start date's weekday or day and month, monthly the day grid with Last day", async () => {
    await render(<RuleForm ruleId={null} onSaved={noop} onDeleted={noop} />);
    // New rule: today (20 Nov 2026, a Friday) in the device zone.
    expect(screen.getByRole("radio", { name: "Day 20" }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole("radio", { name: "Last day" })).toBeTruthy();
    await fireEvent.press(screen.getByTestId("rule-frequency-weekly"));
    expect(screen.getByText("Every Friday")).toBeTruthy();
    expect(screen.queryByRole("radio", { name: "Day 20" })).toBeNull();
    await fireEvent.press(screen.getByTestId("rule-frequency-yearly"));
    expect(screen.getByText("Every 20 Nov")).toBeTruthy();
    expect(screen.getByTestId("rule-frequency-yearly").props.accessibilityState.checked).toBe(true);
  });

  it("edits a rule, pauses it and saves only future changes", async () => {
    const r = rule();
    const onSaved = jest.fn();
    await render(<RuleForm ruleId={r.id} onSaved={onSaved} onDeleted={noop} />);
    expect(screen.getByText("Edit recurring expense")).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "Last day" }));
    await fireEvent(screen.getByTestId("rule-paused"), "valueChange", true);
    await fireEvent.press(screen.getByTestId("rule-save"));
    expect(listRules(mockDb)[0]).toMatchObject({ id: r.id, monthDay: -1, paused: true });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: r.id, paused: true }));
  });

  it("deletes through a confirm sheet, not a system alert", async () => {
    const r = rule();
    const onDeleted = jest.fn();
    await render(<RuleForm ruleId={r.id} onSaved={noop} onDeleted={onDeleted} />);
    await fireEvent.press(screen.getByTestId("rule-delete"));
    expect(screen.getByText("Delete this recurring expense?")).toBeTruthy();
    expect(listRules(mockDb)).toHaveLength(1);
    await fireEvent.press(screen.getByTestId("rule-delete-confirm"));
    expect(listRules(mockDb)).toHaveLength(0);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(reschedule).toHaveBeenCalledTimes(1));
  });

  it("a new rule has no delete button; a deleted rule says it is gone", async () => {
    await render(<RuleForm ruleId={null} onSaved={noop} onDeleted={noop} />);
    expect(screen.queryByTestId("rule-delete")).toBeNull();
    await render(<RuleForm ruleId="gone" onSaved={noop} onDeleted={noop} onBack={noop} />);
    expect(screen.getByText("This recurring expense is no longer available.")).toBeTruthy();
  });

  it("a double tap on Save creates one rule and calls onSaved once", async () => {
    const onSaved = jest.fn();
    await render(<RuleForm ruleId={null} onSaved={onSaved} onDeleted={noop} />);
    await fireEvent.changeText(screen.getByTestId("rule-amount"), "250.000");
    const save = screen.getByTestId("rule-save");
    await pressTwice(save);
    await fireEvent.press(screen.getByTestId("rule-save"));
    expect(listRules(mockDb)).toHaveLength(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("rule-save")).toBeDisabled();
  });

  it("'Repeat this…' double tap: one rule, the receipt linked to it, back once", async () => {
    const { receipt } = seedReceipt();
    const onSaved = jest.fn();
    await render(<RuleForm ruleId={null} fromReceiptId={receipt.id} onSaved={onSaved} onDeleted={noop} />);
    const save = screen.getByTestId("rule-save");
    await pressTwice(save);
    const rules = listRules(mockDb);
    expect(rules).toHaveLength(1);
    expect(getReceipt(mockDb, receipt.id)?.recurringRuleId).toBe(rules[0].id);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("a failed save can be retried", async () => {
    const onSaved = jest.fn();
    const r = rule();
    await render(<RuleForm ruleId={r.id} onSaved={onSaved} onDeleted={noop} />);
    await act(async () => void softDeleteRule(mockDb, r.id));
    await fireEvent.press(screen.getByTestId("rule-save"));
    expect(screen.getByText("Couldn't save the recurring expense. Please try again.")).toBeTruthy();
    expect(screen.getByTestId("rule-save")).not.toBeDisabled();
  });

  it("editing after a save in the same form (split view) arms Save again", async () => {
    const r = rule();
    const onSaved = jest.fn();
    await render(<RuleForm ruleId={r.id} onSaved={onSaved} onDeleted={noop} />);
    await fireEvent.press(screen.getByTestId("rule-save"));
    await fireEvent.press(screen.getByRole("radio", { name: "Last day" }));
    await fireEvent.press(screen.getByTestId("rule-save"));
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(listRules(mockDb)[0].monthDay).toBe(-1);
  });

  it("a double tap on Delete confirm deletes once and calls onDeleted once", async () => {
    const r = rule();
    const onDeleted = jest.fn();
    await render(<RuleForm ruleId={r.id} onSaved={noop} onDeleted={onDeleted} />);
    await fireEvent.press(screen.getByTestId("rule-delete"));
    const confirm = screen.getByTestId("rule-delete-confirm");
    await pressTwice(confirm);
    expect(listRules(mockDb)).toHaveLength(0);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it("Save is the last control in the scroll view (never pinned over a fold)", async () => {
    await render(<RuleForm ruleId={null} onSaved={noop} onDeleted={noop} />);
    const scroll = screen.getByTestId("rule-form-scroll");
    expect(scroll).toContainElement(screen.getByTestId("rule-save"));
  });
});
