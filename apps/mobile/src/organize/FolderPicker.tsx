import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/AppModal";
import { OptionRow } from "@/components/OptionRow";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { createFolder, listFolders } from "@/db/repositories/folders";
import type { FolderKind } from "@/db/schema";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  visible: boolean;
  value: string | null;
  onChange(folderId: string | null): void;
  onClose(): void;
};

/** Sheet to pick a receipt's folder: "No folder", every folder, or create one inline. */
export function FolderPicker({ visible, value, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const version = useDataVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const folders = useMemo(() => (visible ? listFolders(db) : []), [db, visible, version]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FolderKind>("project");

  const close = () => {
    setCreating(false);
    setName("");
    setKind("project");
    onClose();
  };
  const trimmed = name.trim();
  const create = () => {
    if (!trimmed) return;
    const folder = createFolder(db, { name: trimmed, kind });
    setCreating(false);
    setName("");
    setKind("project");
    onChange(folder.id);
  };

  return (
    <AppModal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl }}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flex: 1, gap: theme.spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text }]}>
              {t("folders.pickerTitle")}
            </Text>
            <Pressable accessibilityRole="button" onPress={close} style={{ minHeight: 48, justifyContent: "center" }}>
              <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{t("common.cancel")}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: theme.spacing.sm }} keyboardShouldPersistTaps="handled">
            <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
              <OptionRow label={t("folders.none")} selected={value === null} onPress={() => onChange(null)} />
              {folders.map((f) => (
                <OptionRow key={f.id} label={f.name} selected={f.id === value} onPress={() => onChange(f.id)} />
              ))}
            </View>
            {creating ? (
              <View style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  accessibilityLabel={t("folders.name")}
                  placeholder={t("folders.name")}
                  placeholderTextColor={theme.colors.textMuted}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={create}
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
                <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                  {(["project", "trip"] as const).map((k) => (
                    <View key={k} style={{ flex: 1 }}>
                      <OptionRow
                        label={t(k === "project" ? "folders.kindProject" : "folders.kindTrip")}
                        selected={kind === k}
                        onPress={() => setKind(k)}
                      />
                    </View>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !trimmed }}
                  disabled={!trimmed}
                  onPress={create}
                  style={({ pressed }) => ({
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.primary,
                    opacity: !trimmed ? 0.4 : pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={[theme.type.body, { color: theme.colors.onPrimary, fontWeight: "600" }]}>{t("folders.create")}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setCreating(true)}
                style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: theme.spacing.lg }}
              >
                <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{t("folders.new")}</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </AppModal>
  );
}
