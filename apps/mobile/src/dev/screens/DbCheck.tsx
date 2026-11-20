// Dev-only (Task 8): create + read back + FTS search a receipt on the encrypted DB.
// Task 10: the error a duplicate recurring occurrence raises on the device driver.
import { Redirect } from "expo-router";
import { useState } from "react";
import { Button, ScrollView, Text } from "react-native";

import { useDb } from "@/db/DatabaseProvider";
import { createReceipt, getReceipt, searchReceipts } from "@/db/repositories/receipts";
import type { AppDb } from "@/db/types";
import { seedSyntheticReceipts } from "@/dev/seed";

export default function DbCheck() {
  const db = useDb();
  const [lines, setLines] = useState<string[]>([]);
  if (!__DEV__) return <Redirect href="/" />;

  const run = () => {
    try {
      const r = createReceipt(db, {
        merchant: "Indomaret",
        purchasedAtLocal: "2026-01-01T00:00:00",
        purchasedAtUtc: 1,
        scannedAtUtc: 1,
        currency: "IDR",
        totalMinor: 1000,
        parseSource: "manual",
        fxApproximate: false,
        rawOcrText: "kopi susu",
      });
      const back = getReceipt(db, r.id);
      const hits = searchReceipts(db, "indom");
      const out = [
        `created=${r.id}`,
        `read_back_merchant=${back?.merchant}`,
        `search_hits=${hits.length}`,
      ];
      console.log("DB_CHECK_RESULT " + out.join(" "));
      setLines(out);
    } catch (e) {
      console.log("DB_CHECK_ERROR " + String(e));
      setLines(["ERROR " + String(e)]);
    }
  };

  const seed = () => {
    try {
      const t = new Date();
      const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      const n = seedSyntheticReceipts(db, 500, { home: "IDR", seed: 20261107, today });
      console.log("DB_SEED_RESULT " + n);
      setLines([`seeded=${n}`]);
    } catch (e) {
      console.log("DB_SEED_ERROR " + String(e));
      setLines(["ERROR " + String(e)]);
    }
  };

  // Two live receipts with the same (recurringRuleId, recurringDate) inside one transaction, which
  // is then rolled back: logs the driver's message chain (catch-up skips a duplicate only when it
  // matches /UNIQUE constraint failed/) and whether the transaction still accepts writes after.
  const uniqueCheck = () => {
    const rollback = new Error("dev-unique-check rollback");
    const out: string[] = [];
    const row = (date: string) => ({
      merchant: "Unique check",
      purchasedAtLocal: `${date}T09:00:00`,
      purchasedAtUtc: 1,
      scannedAtUtc: 1,
      currency: "USD",
      totalMinor: 100,
      parseSource: "manual" as const,
      recurringRuleId: "dev-unique-check",
      recurringDate: date,
    });
    try {
      db.transaction((tx) => {
        createReceipt(tx as unknown as AppDb, row("2026-01-01"));
        try {
          createReceipt(tx as unknown as AppDb, row("2026-01-01"));
          out.push("duplicate_insert=accepted");
        } catch (e) {
          const messages: string[] = [];
          for (let cur: unknown = e, i = 0; cur && i < 5; i++) {
            messages.push(String((cur as { message?: unknown }).message));
            cur = (cur as { cause?: unknown }).cause;
          }
          out.push(`messages=${JSON.stringify(messages)}`);
          out.push(`matches_unique=${messages.some((m) => /UNIQUE constraint failed/i.test(m))}`);
        }
        createReceipt(tx as unknown as AppDb, row("2026-01-02"));
        out.push("tx_usable_after=true");
        throw rollback;
      });
    } catch (e) {
      if (e !== rollback) out.push("ERROR " + String(e));
    }
    console.log("DB_UNIQUE_CHECK " + out.join(" "));
    setLines(out);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
      <Button title="Create + read back receipt" onPress={run} />
      <Button title="Seed 500 synthetic receipts" onPress={seed} />
      <Button title="UNIQUE error text" onPress={uniqueCheck} />
      {lines.map((l, i) => (
        <Text key={i} selectable>
          {l}
        </Text>
      ))}
    </ScrollView>
  );
}
