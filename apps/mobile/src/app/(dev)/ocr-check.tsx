// Dev-only (M2 Task 4/12): run receipt-ocr + the heuristic parser on photos picked from the library.
// One row per photo shows amount/date/ms/rotation only. "Copy summary" exposes only the summary
// and those rows (selectable text, no clipboard dep). Raw OCR text is behind a separate toggle.
// `?uri=file://...` (dev only) runs on one file directly, for headless simulator checks.
import * as ImagePicker from "expo-image-picker";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";

import { imageHash, recognizeText } from "../../../modules/receipt-ocr";
import {
  buildCopyText,
  formatRow,
  summarize,
  type CheckRow,
} from "@/ocr/checkReport";
import { OCR_LANGUAGES } from "@/ocr/languages";
import { toLines } from "@/ocr/readingOrder";
import { fromMinor } from "@/money/money";
import { parseReceipt } from "@/parsing";
import { splitReceipts } from "@/parsing/heuristics/split";
import { usePref } from "@/prefs/PrefsProvider";

type Row = CheckRow & {
  name: string;
  lines: string[];
  hash: string;
  errorText?: string;
};

async function runOne(
  uri: string,
  n: number,
  name: string,
  languages: string[],
  home: string,
  locale: string,
): Promise<Row> {
  try {
    const [res, hash] = await Promise.all([
      recognizeText(uri, languages),
      imageHash(uri),
    ]);
    const lines = toLines(res.observations);
    const today = new Date();
    // aiEnabled:false: heuristic parser only, whatever the production flag says.
    const parsed = await parseReceipt(
      lines,
      { homeCurrency: home, locale, today },
      undefined,
      { aiEnabled: false },
    );
    const segments = splitReceipts(lines, { today }).segments.length;
    const total = parsed.totalMinor
      ? `${fromMinor(parsed.totalMinor, parsed.currency)} ${parsed.currency}`
      : null;
    console.log(
      `OCR_CHECK #${n} lines=${lines.length} rotation=${res.rotation} ms=${res.ms} total=${total ? "y" : "n"} date=${parsed.purchasedDate ? "y" : "n"}`,
    );
    return {
      n,
      name,
      lines,
      hash,
      total,
      date: parsed.purchasedDate,
      ms: res.ms,
      rotation: res.rotation,
      segments,
    };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.log(`OCR_CHECK #${n} error=${err.code ?? "?"}`);
    return {
      n,
      name,
      lines: [],
      hash: "",
      total: null,
      date: null,
      ms: 0,
      rotation: 0,
      error: true,
      errorText: `${err.code ?? ""} ${err.message ?? String(e)}`,
    };
  }
}

async function runAll(
  items: { uri: string; name: string }[],
  languages: string[],
  home: string,
  locale: string,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < items.length; i++)
    out.push(
      await runOne(items[i].uri, i + 1, items[i].name, languages, home, locale),
    );
  return out;
}

function rawReport(rows: Row[]): string {
  return rows
    .map((r) =>
      r.error
        ? `# #${r.n}\nERROR ${r.errorText}`
        : `# #${r.n}  hash=${r.hash}\n${r.lines.join("\n")}`,
    )
    .join("\n\n");
}

export default function OcrCheck() {
  const language = usePref("language") ?? "en";
  const home = usePref("homeCurrency") ?? "USD";
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!__DEV__ || !uri) return;
    let live = true;
    void runAll(
      [{ uri, name: "uri" }],
      OCR_LANGUAGES(language),
      home,
      language,
    ).then((out) => {
      if (live) setRows(out);
    });
    return () => {
      live = false;
    };
  }, [uri, language, home]);

  if (!__DEV__) return <Redirect href="/" />;

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 30,
      quality: 1,
    });
    if (res.canceled) return;
    setBusy(true);
    const items = res.assets.map((a, i) => ({
      uri: a.uri,
      name: a.fileName ?? `image-${i + 1}`,
    }));
    setRows(await runAll(items, OCR_LANGUAGES(language), home, language));
    setBusy(false);
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 24, paddingTop: 80, gap: 12 }}
    >
      <Button
        title={busy ? "Running..." : "Pick photos (up to 30)"}
        disabled={busy}
        onPress={pick}
      />
      {rows.length > 0 && (
        <Text style={{ fontWeight: "700" }}>{summarize(rows)}</Text>
      )}
      <Button
        title="Copy summary"
        disabled={rows.length === 0}
        onPress={() => setShowCopy((s) => !s)}
      />
      {showCopy && (
        // Long-press, Select All, Copy. Amounts/dates/timings only.
        <Text
          selectable
          style={{
            borderWidth: 1,
            padding: 8,
            fontFamily: "Menlo",
            fontSize: 11,
          }}
        >
          {buildCopyText(rows)}
        </Text>
      )}
      {rows.map((r) => (
        <Text key={r.n} style={{ fontFamily: "Menlo", fontSize: 12 }}>
          {formatRow(r)}
        </Text>
      ))}
      <Button
        title={showRaw ? "Hide raw OCR text" : "Show raw OCR text (private)"}
        disabled={rows.length === 0}
        onPress={() => setShowRaw((s) => !s)}
      />
      {showRaw && (
        <View style={{ gap: 4 }}>
          <Text style={{ color: "#b00020", fontWeight: "700" }}>
            Warning: this is the private text of your receipts. Do not paste it
            anywhere.
          </Text>
          <Text selectable style={{ fontFamily: "Menlo", fontSize: 11 }}>
            {rawReport(rows)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
