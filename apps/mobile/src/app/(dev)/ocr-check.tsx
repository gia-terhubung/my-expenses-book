// Dev-only (M2 Task 4): run receipt-ocr on photos picked from the library.
// Shows lines + ms + rotation + dHash per image. Text stays on device: the report is shown
// as selectable text (no clipboard dep); the console only gets a text-free summary.
// `?uri=file://...` (dev only) runs on one file directly, for headless simulator checks.
import * as ImagePicker from "expo-image-picker";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";

import { imageHash, recognizeText } from "../../../modules/receipt-ocr";
import { OCR_LANGUAGES } from "@/ocr/languages";
import { toLines } from "@/ocr/readingOrder";
import { usePref } from "@/prefs/PrefsProvider";

type Row = { name: string; lines: string[]; ms: number; rotation: number; hash: string; error?: string };

const TOTAL_RE = /total|jumlah|bayar|biaya|tagihan/i;
const DATE_RE = /\b\d{1,2}[\/.\- ](\d{1,2}|[A-Za-z]{3,9})[\/.\- ,]+\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/;

async function runOne(uri: string, name: string, languages: string[]): Promise<Row> {
  try {
    const [res, hash] = await Promise.all([recognizeText(uri, languages), imageHash(uri)]);
    const lines = toLines(res.observations);
    const text = lines.join("\n");
    console.log(
      `OCR_CHECK ${name} lines=${lines.length} obs=${res.observations.length} rotation=${res.rotation} ` +
        `ms=${res.ms} size=${res.width}x${res.height} hash=${hash} total=${TOTAL_RE.test(text) ? "y" : "n"} ` +
        `date=${DATE_RE.test(text) ? "y" : "n"}`,
    );
    return { name, lines, ms: res.ms, rotation: res.rotation, hash };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.log(`OCR_CHECK ${name} error=${err.code ?? "?"}`);
    return { name, lines: [], ms: 0, rotation: 0, hash: "", error: `${err.code ?? ""} ${err.message ?? String(e)}` };
  }
}

async function runAll(items: { uri: string; name: string }[], languages: string[]): Promise<Row[]> {
  const out: Row[] = [];
  for (const it of items) out.push(await runOne(it.uri, it.name, languages));
  return out;
}

function report(rows: Row[]): string {
  return rows
    .map((r) =>
      r.error
        ? `# ${r.name}\nERROR ${r.error}`
        : `# ${r.name}  ${r.ms}ms  rotation=${r.rotation}  hash=${r.hash}\n${r.lines.join("\n")}`,
    )
    .join("\n\n");
}

export default function OcrCheck() {
  const language = usePref("language") ?? "en";
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!__DEV__ || !uri) return;
    let live = true;
    void runAll([{ uri, name: uri.split("/").pop() ?? "uri" }], OCR_LANGUAGES(language)).then((out) => {
      if (live) setRows(out);
    });
    return () => {
      live = false;
    };
  }, [uri, language]);

  if (!__DEV__) return <Redirect href="/" />;

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 1,
    });
    if (res.canceled) return;
    setBusy(true);
    const items = res.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `image-${i + 1}` }));
    setRows(await runAll(items, OCR_LANGUAGES(language)));
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 12 }}>
      <Button title={busy ? "Running..." : "Pick photos"} disabled={busy} onPress={pick} />
      <Button title="Copy report" disabled={rows.length === 0} onPress={() => setShowReport((s) => !s)} />
      {showReport && (
        // Long-press → Copy (whole block) from the system menu; nothing leaves the device from here.
        <Text selectable style={{ borderWidth: 1, padding: 8, fontFamily: "Menlo", fontSize: 11 }}>
          {report(rows)}
        </Text>
      )}
      {rows.map((r, i) => (
        <View key={i} style={{ gap: 4 }}>
          <Text style={{ fontWeight: "600" }}>
            {r.name} · {r.ms}ms · rotation: {r.rotation} · {r.lines.length} lines
          </Text>
          <Text selectable style={{ fontFamily: "Menlo", fontSize: 11 }}>
            {r.error ? `ERROR ${r.error}` : `hash ${r.hash}\n${r.lines.join("\n")}`}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
