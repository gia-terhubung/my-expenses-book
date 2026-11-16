// Dev-only (Task 8): create + read back + FTS search a receipt on the encrypted DB.
import { Redirect } from "expo-router";
import { useState } from "react";
import { Button, ScrollView, Text } from "react-native";

import { useDb } from "@/db/DatabaseProvider";
import { createReceipt, getReceipt, searchReceipts } from "@/db/repositories/receipts";
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

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
      <Button title="Create + read back receipt" onPress={run} />
      <Button title="Seed 500 synthetic receipts" onPress={seed} />
      {lines.map((l, i) => (
        <Text key={i} selectable>
          {l}
        </Text>
      ))}
    </ScrollView>
  );
}
