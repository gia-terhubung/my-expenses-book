// Dev-only (Task 10): myexpensesbook://dev/clock?now=<iso>&tz=<IANA> shifts now() and the device
// zone for catch-up, Home and Stats, so end-to-end flows can jump in time without touching the
// simulator clock. No params (or reset=1) clears it. In-memory only: a cold launch resets it.
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";

import { parseDevClock, setDevClock } from "@/dates/clock";

export default function DevClock() {
  const { now, tz, reset } = useLocalSearchParams<{ now?: string; tz?: string; reset?: string }>();
  // Validity does not depend on the real clock; the offset is taken when the effect applies it.
  const invalid = useMemo(() => parseDevClock({ now, tz, reset }, 0) === undefined, [now, tz, reset]);

  useEffect(() => {
    const next = parseDevClock({ now, tz, reset }, Date.now());
    if (next === undefined) {
      console.log("DEV_CLOCK_INVALID " + JSON.stringify({ now, tz, reset }));
      return;
    }
    setDevClock(next);
    console.log("DEV_CLOCK_SET " + JSON.stringify(next));
    router.replace("/");
  }, [now, tz, reset]);

  return (
    <View style={{ padding: 24, paddingTop: 80 }}>
      <Text>{invalid ? "Dev clock: invalid params" : "Dev clock: setting"}</Text>
    </View>
  );
}
