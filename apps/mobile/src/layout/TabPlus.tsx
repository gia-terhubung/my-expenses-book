import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { useAddReceiptContext } from "@/capture/AddReceiptProvider";

import { FloatingAddButton } from "./FloatingAddButton";
import { useInNativeTabs, useNavSpike } from "./navSpike";

/**
 * SPIKE: the + on an iOS native tab screen. Rendered inside each tab screen so it reads that
 * screen's safe area (NativeTabs gives each tab its own, which already includes the tab bar or the
 * Duo side column). Variant D (native bottom toolbar) exists only on Receipts (its own Stack);
 * the other tabs keep variant C so the + is never missing. Renders nothing off iOS native tabs.
 */
export function TabPlus({ toolbar = false }: { toolbar?: boolean }) {
  const inNativeTabs = useInNativeTabs();
  const { plus } = useNavSpike();
  if (!inNativeTabs) return null;
  if (plus === "D" && toolbar) return <ToolbarPlus />;
  return <FloatingAddButton />;
}

function ToolbarPlus() {
  const { t } = useTranslation();
  const add = useAddReceiptContext();
  return (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button icon="plus" variant="prominent" accessibilityLabel={t("capture.add")} onPress={add.open}>
        {t("capture.add")}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}
