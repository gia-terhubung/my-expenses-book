import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/AppModal";
import { useTheme } from "@/theme/ThemeProvider";

import { CATEGORY_COLORS } from "./categoryColors";

type Props = {
  visible: boolean;
  /** "create" asks for name and color; "rename" only the name. */
  mode: "create" | "rename";
  initialName?: string;
  onSubmit(value: { name: string; color: string }): void;
  onClose(): void;
};

/** Sheet to name a new category (with a color) or rename an existing one. */
export function CategoryForm(props: Props) {
  return (
    <AppModal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      {/* Mounted only while open, so every opening starts from the initial values. */}
      {props.visible ? <FormBody {...props} /> : null}
    </AppModal>
  );
}

function FormBody({ mode, initialName = "", onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0]);

  const trimmed = name.trim();
  const create = mode === "create";
  const submit = () => {
    if (trimmed) onSubmit({ name: trimmed, color });
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flex: 1, gap: theme.spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text }]}>
            {t(create ? "categoryManage.newTitle" : "categoryManage.renameTitle")}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, justifyContent: "center" }}>
            <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>
              {t("common.cancel")}
            </Text>
          </Pressable>
        </View>
        <TextInput
          value={name}
          onChangeText={setName}
          accessibilityLabel={t("categoryManage.name")}
          placeholder={t("categoryManage.name")}
          placeholderTextColor={theme.colors.textMuted}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
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
        {create ? (
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {CATEGORY_COLORS.map((c, i) => (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ checked: color === c }}
                accessibilityLabel={`${t("categoryManage.color")} ${i + 1}`}
                onPress={() => setColor(c)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: theme.radius.pill,
                  backgroundColor: c,
                  borderWidth: 3,
                  borderColor: color === c ? theme.colors.text : "transparent",
                }}
              />
            ))}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !trimmed }}
          disabled={!trimmed}
          onPress={submit}
          style={({ pressed }) => ({
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
            opacity: !trimmed ? 0.4 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={[theme.type.body, { color: theme.colors.onPrimary, fontWeight: "600" }]}>
            {t(create ? "categoryManage.add" : "common.save")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
