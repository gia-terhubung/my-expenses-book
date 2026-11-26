import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import {
  KEYBOARD_SCROLL_PROPS,
  useKeyboardForm,
} from "@/layout/keyboardScroll";
import { AppModal } from "@/components/AppModal";
import {
  NativeSheetHost,
  SheetBar,
  useNativeSheets,
} from "@/layout/NativeSheet";
import { Button } from "@/components/Button";
import { OptionRow } from "@/components/OptionRow";
import { Input } from "@/components/Input";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { createFolder, listFolders } from "@/db/repositories/folders";
import type { FolderKind } from "@/db/schema";
import { useSheetTopInset } from "@/layout/useSheetTopInset";
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
  const { scrollProps: keyboardScroll, bottomRoom } = useKeyboardForm();
  const insets = useSafeAreaInsets();
  const sheetTop = useSheetTopInset();
  const nativeSheets = useNativeSheets();
  const db = useDb();
  const version = useDataVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const folders = useMemo(
    () => (visible ? listFolders(db) : []),
    [db, visible, version],
  );
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

  // SPIKE (iOS): native sheet page with the X at the bottom of the Duo column.
  const body = (native: boolean) => (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing.xl,
        paddingTop: native ? theme.spacing.lg : sheetTop + theme.spacing.xl,
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 560,
          alignSelf: "center",
          flex: 1,
          gap: theme.spacing.lg,
        }}
      >
        {native ? (
          <SheetBar title={t("folders.pickerTitle")} onCancel={close} />
        ) : (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              accessibilityRole="header"
              style={[theme.type.title, { color: theme.colors.text }]}
            >
              {t("folders.pickerTitle")}
            </Text>
            <Button
              variant="quiet"
              label={t("common.cancel")}
              onPress={close}
            />
          </View>
        )}
        <ScrollView
          {...KEYBOARD_SCROLL_PROPS}
          {...keyboardScroll}
          contentContainerStyle={{
            gap: theme.spacing.sm,
            paddingBottom: bottomRoom,
          }}
        >
          <View
            accessibilityRole="radiogroup"
            style={{ gap: theme.spacing.sm }}
          >
            <OptionRow
              label={t("folders.none")}
              selected={value === null}
              onPress={() => onChange(null)}
            />
            {folders.map((f) => (
              <OptionRow
                key={f.id}
                label={f.name}
                selected={f.id === value}
                onPress={() => onChange(f.id)}
              />
            ))}
          </View>
          {creating ? (
            <View
              style={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}
            >
              <Input
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
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.text,
                  },
                ]}
              />
              <View
                accessibilityRole="radiogroup"
                style={{ flexDirection: "row", gap: theme.spacing.sm }}
              >
                {(["project", "trip"] as const).map((k) => (
                  <View key={k} style={{ flex: 1 }}>
                    <OptionRow
                      label={t(
                        k === "project"
                          ? "folders.kindProject"
                          : "folders.kindTrip",
                      )}
                      selected={kind === k}
                      onPress={() => setKind(k)}
                    />
                  </View>
                ))}
              </View>
              <Button
                variant="primary"
                label={t("folders.create")}
                disabled={!trimmed}
                onPress={create}
              />
            </View>
          ) : (
            <Button
              variant="quiet"
              label={t("folders.new")}
              onPress={() => setCreating(true)}
              style={{ paddingHorizontal: theme.spacing.lg }}
            />
          )}
        </ScrollView>
      </View>
    </View>
  );

  if (nativeSheets) {
    return (
      <NativeSheetHost visible={visible} onClose={close}>
        {visible ? body(true) : null}
      </NativeSheetHost>
    );
  }
  return (
    <AppModal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      {body(false)}
    </AppModal>
  );
}
