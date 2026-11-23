import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

/** Round 48 dp icon button: the back chevron on every page and the guide's close. */
export function IconButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: "chevron-back" | "close";
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, size } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size.touch,
        height: size.touch,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: size.touch / 2,
        backgroundColor: pressed ? colors.surfacePressed : "transparent",
      })}
    >
      <Ionicons name={icon} size={26} color={colors.primary} />
    </Pressable>
  );
}
