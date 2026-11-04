import { useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CURRENCIES } from "@/money/currencies";
import { useTheme } from "@/theme/ThemeProvider";

import { OptionRow } from "./OptionRow";

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
      <TextInput
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
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
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
            accessibilityLabel={item.name === item.code ? item.code : `${item.code} ${item.name}`}
            selected={item.code === value}
            onPress={() => onChange(item.code)}
          />
        )}
      />
    </View>
  );
}
