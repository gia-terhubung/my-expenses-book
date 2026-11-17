// Spike (Task 3): on-device LLM availability + receipt parse. Dev-only.
// Auto-runs availability on mount; paste an OCR dump to parse it. (The bundled OCR samples were
// removed from git: they may hold real receipt text and now stay local and untracked.)
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Button, ScrollView, Text, TextInput } from "react-native";

import ReceiptAI from "../../../modules/receipt-ai";

const DEFAULT_HINTS = { locale: "en-US", homeCurrency: "USD" };

async function parseTimed(text: string, hints: { locale: string; homeCurrency: string }): Promise<string> {
  const t0 = Date.now();
  try {
    const json = await ReceiptAI.parseReceipt(text, hints);
    return `${Date.now() - t0}ms ${json}`;
  } catch (e) {
    return `${Date.now() - t0}ms ERROR ${(e as Error).message}`;
  }
}

async function runAll(): Promise<string[]> {
  const out: string[] = [];
  const availability = await ReceiptAI.getAvailability();
  out.push(`availability=${JSON.stringify(availability)}`);
  return out;
}

export default function AiSpike() {
  const [lines, setLines] = useState<string[]>(["running..."]);
  const [dump, setDump] = useState("");
  const [manual, setManual] = useState("");
  useEffect(() => {
    if (!__DEV__) return;
    runAll()
      .then((l) => {
        console.log("AI_SPIKE_RESULT_BEGIN\n" + l.join("\n") + "\nAI_SPIKE_RESULT_END");
        setLines(l);
      })
      .catch((e) => {
        console.log("AI_SPIKE_ERROR " + String(e));
        setLines(["ERROR " + String(e)]);
      });
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
      {lines.map((l, i) => (
        <Text key={i} selectable style={{ marginBottom: 8 }}>
          {l}
        </Text>
      ))}
      <TextInput
        multiline
        placeholder="Paste OCR dump"
        value={dump}
        onChangeText={setDump}
        style={{ borderWidth: 1, minHeight: 120, padding: 8, marginTop: 16 }}
      />
      <Button title="Parse" onPress={() => parseTimed(dump, DEFAULT_HINTS).then(setManual)} />
      <Text selectable>{manual}</Text>
    </ScrollView>
  );
}
