import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme/ThemeProvider";

import { infoKey, type InfoTopic } from "./info";
import { InfoSheet } from "./InfoSheet";

/** (i) next to a confusing setting or number; opens that topic's explanation sheet. */
export function InfoButton({ topic, example, testID }: { topic: InfoTopic; example?: string; testID?: string }) {
  const { t } = useTranslation();
  const { colors, size } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={t("info.about", { topic: t(infoKey(topic, "title")) })}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          width: size.touch,
          height: size.touch,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size.touch / 2,
          backgroundColor: pressed ? colors.surfacePressed : "transparent",
        })}
      >
        <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
      </Pressable>
      {open ? <InfoSheet topic={topic} example={example} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
