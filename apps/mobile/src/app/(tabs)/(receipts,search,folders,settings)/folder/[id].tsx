import { useLocalSearchParams } from "expo-router";

import { CollectionScreen } from "@/organize/CollectionScreen";

export default function FolderRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CollectionScreen kind="folder" folderId={id} />;
}
