import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/AppModal";
import { Button } from "@/components/Button";
import { OptionRow } from "@/components/OptionRow";
import { Input } from "@/components/Input";
import type { FolderKind } from "@/db/schema";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  visible: boolean;
  /** "create" asks for name and kind; "rename" only the name. */
  mode: "create" | "rename";
  initialName?: string;
  onSubmit(value: { name: string; kind: FolderKind }): void;
  onClose(): void;
};

/** Sheet to name a new folder (project or trip) or rename an existing one. */
export function FolderForm(props: Props) {
  return (
    <AppModal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      {/* Mounted only while open, so every opening starts from the initial name and kind. */}
      {props.visible ? <FormBody {...props} /> : null}
    </AppModal>
  );
}

function FormBody({ mode, initialName = "", onSubmit, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<FolderKind>("project");

  const trimmed = name.trim();
  const submit = () => {
    if (trimmed) onSubmit({ name: trimmed, kind });
  };
  const create = mode === "create";

  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.background,
          padding: theme.spacing.xl,
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
              {t(create ? "folders.newTitle" : "folders.renameTitle")}
            </Text>
            <Button variant="quiet" label={t("common.cancel")} onPress={onClose} />
          </View>
          <Input
            value={name}
            onChangeText={setName}
            accessibilityLabel={t("folders.name")}
            placeholder={t("folders.name")}
            placeholderTextColor={theme.colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
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
          {create ? (
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
          ) : null}
          <Button
            variant="primary"
            label={t(create ? "folders.create" : "common.save")}
            disabled={!trimmed}
            onPress={submit}
          />
        </View>
      </View>
    </>
  );
}
