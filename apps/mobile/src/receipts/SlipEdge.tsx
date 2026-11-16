import { useState } from "react";
import { View } from "react-native";

const TOOTH = 10;

/**
 * Torn bottom edge of the slip: a row of page-coloured circles centred on the slip's bottom edge,
 * so each one bites a half circle out of it. Place it as the last child of the slip.
 */
export function SlipEdge({ color }: { color: string }) {
  const [width, setWidth] = useState(0);
  return (
    <View
      testID="slip-edge"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: -TOOTH / 2,
        height: TOOTH,
        flexDirection: "row",
        overflow: "hidden",
      }}
    >
      {Array.from({ length: Math.ceil(width / TOOTH) }, (_, i) => (
        <View
          key={i}
          testID="slip-tooth"
          style={{ width: TOOTH, height: TOOTH, borderRadius: TOOTH / 2, backgroundColor: color }}
        />
      ))}
    </View>
  );
}
