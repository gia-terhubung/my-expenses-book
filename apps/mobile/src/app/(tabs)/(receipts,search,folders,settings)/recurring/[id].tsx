import { router, Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { StatusBarInset } from "@/layout/StatusBarInset";
import { NEW_RULE } from "@/recurring/RecurringScreen";
import { RuleForm } from "@/recurring/RuleForm";

/**
 * The rule form on its own (one pane): `new` creates, `?from=<receiptId>` is "Repeat this…".
 * Saving or deleting goes back where the form was opened from (the receipt or the list).
 */
export default function RecurringRuleRoute() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const back = () => router.back();
  const { t } = useTranslation();
  return (
    <StatusBarInset>
      <Stack.Screen options={{ title: t(id === NEW_RULE ? "recurring.newTitle" : "recurring.editTitle") }} />
      <RuleForm ruleId={id === NEW_RULE ? null : id} fromReceiptId={from} onSaved={back} onDeleted={back} onBack={back} />
    </StatusBarInset>
  );
}
