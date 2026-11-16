import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CURRENCIES } from "@/money/currencies";
import { useTheme } from "@/theme/ThemeProvider";

import { OptionRow } from "./OptionRow";
import { Input } from "@/components/Input";

/** Localized currency name; Hermes may lack Intl.DisplayNames (or the locale), so fall back to the code. */
const ROW = 48;
const GAP = 8;

export function currencyName(lang: string, code: string): string {
  try {
    if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") return code;
    return new Intl.DisplayNames(lang, { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "USD US Dollar", or just "IDR" when no localized name is available. */
export function currencyLabel(lang: string, code: string): string {
  const name = currencyName(lang, code);
  return name === code ? code : `${code} ${name}`;
}

export function CurrencyPicker({
  lang,
  value,
  onChange,
}: {
  lang: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const items = useMemo(
    () => CURRENCIES.map(({ code }) => ({ code, name: currencyName(lang, code) })),
    [lang],
  );
  // Open scrolled to the current selection (fixed row height, so offsets are computable).
  const [initialIndex] = useState(() => Math.max(0, items.findIndex((i) => i.code === value)));
  const q = query.trim().toLowerCase();
  const data = useMemo(
    () => (q ? items.filter((i) => i.code.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)) : items),
    [items, q],
  );

  return (
    <View style={{ flex: 1, gap: theme.spacing.md }}>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder={t("common.search")}
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={[
          theme.type.body,
          {
            minHeight: 48,
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
          },
        ]}
      />
      <FlatList
        data={data}
        keyExtractor={(i) => i.code}
        extraData={value}
        getItemLayout={(_, index) => ({ length: ROW, offset: (ROW + GAP) * index, index })}
        initialScrollIndex={initialIndex}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        renderItem={({ item }) => (
          <OptionRow
            label={item.code}
            detail={item.name === item.code ? undefined : item.name}
            accessibilityLabel={currencyLabel(lang, item.code)}
            selected={item.code === value}
            onPress={() => onChange(item.code)}
          />
        )}
      />
    </View>
  );
}
