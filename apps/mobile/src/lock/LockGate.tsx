import { useEffect, useRef, type ReactNode } from "react";
import { View } from "react-native";

import { LockScreen } from "./LockScreen";
import { useLockGate } from "./useLockGate";

/**
 * Renders an opaque lock overlay above children while locked. Children stay mounted (no state
 * loss) but are hidden from accessibility. Prompts once per lock; failure leaves the Retry button.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { locked, unlock } = useLockGate();
  const prompted = useRef(false);

  useEffect(() => {
    if (!locked) {
      prompted.current = false;
    } else if (!prompted.current) {
      prompted.current = true;
      void unlock();
    }
  }, [locked, unlock]);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        accessibilityElementsHidden={locked}
        importantForAccessibility={locked ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {locked ? <LockScreen onUnlock={unlock} /> : null}
    </View>
  );
}
