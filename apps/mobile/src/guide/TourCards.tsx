import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { useTheme } from "@/theme/ThemeProvider";

import type { GuideMode } from "./guideLayout";
import { GuideShell } from "./GuideShell";
import { ReviewIllustration, ScanIllustration, SlipIllustration } from "./illustrations";

const CARDS = [
  { key: "scan", Art: ScanIllustration },
  { key: "review", Art: ReviewIllustration },
  { key: "totals", Art: SlipIllustration },
] as const;

type Props = {
  mode: GuideMode;
  onBackFromFirst: () => void;
  onDone: () => void;
  /** Replay only. */
  onClose?: () => void;
};

/** Three "how it works" cards after setup. Buttons only (a paged scroller jumps on every fold). */
export function TourCards({ mode, onBackFromFirst, onDone, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, type, spacing } = useTheme();
  const [index, setIndex] = useState(0);
  const card = CARDS[index];
  const last = index === CARDS.length - 1;

  return (
    <GuideShell
      mode={mode}
      dots={{ n: index + 1, total: CARDS.length }}
      title={t(`guide.cards.${card.key}.title`)}
      explain={<card.Art />}
      control={<Text style={[type.body, { color: colors.text }]}>{t(`guide.cards.${card.key}.body`)}</Text>}
      controlFixed
      footer={
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
            <Button variant="quiet" label={t("common.back")} onPress={() => (index === 0 ? onBackFromFirst() : setIndex(index - 1))} />
            <Button
              variant="primary"
              align="center"
              label={last ? t("guide.finish") : t("common.next")}
              onPress={() => (last ? onDone() : setIndex(index + 1))}
            />
          </View>
          {!last ? <Button variant="quiet" tone="muted" align="center" label={t("guide.skip")} onPress={onDone} /> : null}
        </View>
      }
      onClose={onClose}
    />
  );
}
