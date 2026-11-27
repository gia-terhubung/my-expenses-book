import { useLocalSearchParams } from "expo-router";

import { CollectionScreen } from "@/organize/CollectionScreen";

export default function TaxYearRoute() {
  const { year } = useLocalSearchParams<{ year: string }>();
  return <CollectionScreen kind="taxYear" year={Number(year)} />;
}
