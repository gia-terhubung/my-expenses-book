import { act, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { createPrefs, usePrefFrom, type KV, type PrefsStore } from "./prefs";

function memoryKv(): KV {
  const data = new Map<string, string>();
  return { getString: (k) => data.get(k), set: (k, v) => void data.set(k, v), delete: (k) => void data.delete(k) };
}

const FX = { base: "usd", latestDate: "2026-11-20", tables: {} } as never;

let renders = 0;
function FxBase({ store }: { store: PrefsStore }) {
  renders++;
  const fx = usePrefFrom(store, "fxTables");
  return <Text>{fx ? (fx as { base: string }).base : "none"}</Text>;
}

describe("usePrefFrom", () => {
  beforeEach(() => {
    renders = 0;
  });

  it("reads an object pref without re-rendering in a loop (store.get parses a new object each call)", async () => {
    const store = createPrefs(memoryKv());
    store.set("fxTables", FX);
    await render(<FxBase store={store} />);
    expect(screen.getByText("usd")).toBeTruthy();
    expect(renders).toBeLessThan(5);
  });

  it("re-renders with the new object when the pref changes", async () => {
    const store = createPrefs(memoryKv());
    store.set("fxTables", FX);
    await render(<FxBase store={store} />);
    await act(async () => store.set("fxTables", { ...(FX as object), base: "idr" } as never));
    expect(screen.getByText("idr")).toBeTruthy();
  });
});
