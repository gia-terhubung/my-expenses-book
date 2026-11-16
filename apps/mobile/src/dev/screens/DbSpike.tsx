// Spike (Task 4): SQLCipher + FTS5 on device. Dev-only.
import { Redirect } from "expo-router";
import * as SQLite from "expo-sqlite";
import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";

const KEY = "0123456789abcdef".repeat(4); // 64 hex chars
const WRONG = "fedcba9876543210".repeat(4);
const DB = "spike.db";

async function run(): Promise<string[]> {
  const out: string[] = [];
  await SQLite.deleteDatabaseAsync(DB).catch(() => {});
  let db = await SQLite.openDatabaseAsync(DB);
  await db.execAsync(`PRAGMA key = "x'${KEY}'"`);
  const v = await db.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version");
  out.push(`cipher_version=${JSON.stringify(v?.cipher_version ?? null)}`);
  await db.execAsync("CREATE VIRTUAL TABLE docs USING fts5(body)");
  await db.runAsync("INSERT INTO docs(body) VALUES (?), (?)", "coffee at the corner cafe", "taxi to airport");
  const hits = await db.getAllAsync<{ body: string }>("SELECT body FROM docs WHERE docs MATCH ?", "coffee");
  out.push(`fts5_match=${JSON.stringify(hits)}`);
  await db.closeAsync();

  db = await SQLite.openDatabaseAsync(DB);
  try {
    await db.execAsync(`PRAGMA key = "x'${WRONG}'"`);
    await db.getFirstAsync("SELECT count(*) FROM sqlite_master");
    out.push("wrong_key=NO_ERROR (BAD)");
  } catch (e) {
    out.push(`wrong_key_error=${(e as Error).message}`);
  }
  await db.closeAsync();
  // Leave an encrypted file on disk for inspection with sqlite3.
  const ok = await SQLite.openDatabaseAsync(DB);
  await ok.execAsync(`PRAGMA key = "x'${KEY}'"`);
  const n = await ok.getFirstAsync<{ c: number }>("SELECT count(*) AS c FROM docs");
  out.push(`reopen_right_key_rows=${n?.c}`);
  await ok.closeAsync();
  return out;
}

export default function DbSpike() {
  const [lines, setLines] = useState<string[]>(["running..."]);
  useEffect(() => {
    if (!__DEV__) return;
    run()
      .then((l) => {
        console.log("DB_SPIKE_RESULT_BEGIN\n" + l.join("\n") + "\nDB_SPIKE_RESULT_END");
        setLines(l);
      })
      .catch((e) => {
        console.log("DB_SPIKE_ERROR " + String(e));
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
    </ScrollView>
  );
}
