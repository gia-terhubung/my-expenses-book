import { useWindowDimensions, View } from "react-native";

const TOOTH = 10;

/**
 * Torn bottom edge of the slip: a row of page-coloured circles centred on the slip's bottom edge,
 * so each one bites a half circle out of it. Place it as the last child of the slip.
 * The row is sized from the window width and clipped, not measured: on a rotation or unfold
 * Fabric does not resend onLayout here, which left the edge half-drawn on the iPhone Duo.
 */
export function SlipEdge({ color }: { color: string }) {
  const { width } = useWindowDimensions();
  return (
    <View
      testID="slip-edge"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      pointerEvents="none"
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
