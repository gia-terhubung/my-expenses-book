// Spike (Task 3): on-device LLM availability + receipt parse. Dev-only.
// Auto-runs availability and all bundled OCR samples on mount; also allows pasting a dump.
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Button, ScrollView, Text, TextInput } from "react-native";

import ReceiptAI from "../../../modules/receipt-ai";
import { OCR_SAMPLES } from "../../../spikes/ocr-samples";

const HINTS: Record<string, { locale: string; homeCurrency: string }> = {
  "01-indomaret-id": { locale: "id-ID", homeCurrency: "IDR" },
  "02-starbucks-us": { locale: "en-US", homeCurrency: "USD" },
  "03-paris-cafe-fr": { locale: "fr-FR", homeCurrency: "EUR" },
  "04-grab-ride-id": { locale: "id-ID", homeCurrency: "IDR" },
  "05-tokyo-konbini-ja": { locale: "ja-JP", homeCurrency: "JPY" },
};
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
  for (const s of OCR_SAMPLES) {
    out.push(`${s.name}: ${await parseTimed(s.text, HINTS[s.name] ?? DEFAULT_HINTS)}`);
  }
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
