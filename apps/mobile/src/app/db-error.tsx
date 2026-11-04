import { Redirect } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Text, TextInput, View } from "react-native";

const CONFIRM_WORD = "RESET";

/** Shown by DatabaseProvider when the data cannot be unlocked. Reset is destructive and confirmed. */
export function DbErrorScreen({ onReset }: { onReset: () => void | Promise<void> }) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>
        {t("dbError.title")}
      </Text>
      <Text>
        {t("dbError.resetWarning", { word: CONFIRM_WORD })}
      </Text>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={CONFIRM_WORD}
        style={{ borderWidth: 1, borderRadius: 8, padding: 12 }}
      />
      <Button
        title={t("dbError.resetButton")}
        color="#b00020"
        disabled={typed !== CONFIRM_WORD}
        onPress={onReset}
      />
    </View>
  );
}

// Route entry: the provider renders DbErrorScreen itself; reaching this directly means no error.
export default function DbErrorRoute() {
  return <Redirect href="/" />;
}
