import { useIsFocused } from "expo-router";
import { useState } from "react";

import { StatusBarInset } from "@/layout/StatusBarInset";
import { createExpoIapTipJar } from "@/payments/expoIap";
import { TipJarScreen } from "@/tips/TipJarScreen";

export default function TipJarRoute() {
  const [jar] = useState(createExpoIapTipJar);
  const focused = useIsFocused();
  return (
    <StatusBarInset>
      <TipJarScreen jar={jar} paused={!focused} />
    </StatusBarInset>
  );
}
