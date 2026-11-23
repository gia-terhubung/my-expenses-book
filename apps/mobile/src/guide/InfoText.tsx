import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme/ThemeProvider";

import { infoKey, paragraphs, type InfoTopic } from "./info";

/** A topic's explanation as body paragraphs: the summary (optional) then the body. */
export function InfoText({ topic, showSummary = false }: { topic: InfoTopic; showSummary?: boolean }) {
  const { t } = useTranslation();
  const { colors, type, spacing } = useTheme();
  const parts = [...(showSummary ? [t(infoKey(topic, "summary"))] : []), ...paragraphs(t(infoKey(topic, "body")))];
  return (
    <View style={{ gap: spacing.md }}>
      {parts.map((p, i) => (
        <Text key={i} style={[type.body, { color: i === 0 && showSummary ? colors.text : colors.textMuted }]}>
          {p}
        </Text>
      ))}
    </View>
  );
}
