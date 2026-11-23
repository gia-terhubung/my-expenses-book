import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppModal } from "@/components/AppModal";
import { Button } from "@/components/Button";
import { useSheetTopInset } from "@/layout/useSheetTopInset";
import { useTheme } from "@/theme/ThemeProvider";

import { ExampleCard } from "./ExampleCard";
import { infoKey, type InfoTopic } from "./info";
import { InfoText } from "./InfoText";

/** The explanation sheet behind an (i): title and Done on top, the example, then the text. */
export function InfoSheet({ topic, example, onClose }: { topic: InfoTopic; example?: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, type, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const sheetTop = useSheetTopInset();
  return (
    <AppModal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: sheetTop + spacing.xl }}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flex: 1, paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.md }}>
            <Text accessibilityRole="header" style={[type.title, { color: colors.text, flexShrink: 1 }]}>
              {t(infoKey(topic, "title"))}
            </Text>
            <Button variant="quiet" label={t("common.done")} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
            {example ? <ExampleCard value={example} /> : null}
            <InfoText topic={topic} showSummary />
          </ScrollView>
        </View>
      </View>
    </AppModal>
  );
}
