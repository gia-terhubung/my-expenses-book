import { router } from "expo-router";

import { getFilterRequest } from "@/search/filterBridge";
import { FilterSheetPage } from "@/search/FilterSheet";
import { EMPTY_SEARCH } from "@/search/filterState";

/** SPIKE (iOS): Search filters as a native sheet page (Cancel and Apply in Apple's bar). */
export default function SearchFilterRoute() {
  const request = getFilterRequest();
  return (
    <FilterSheetPage
      value={request?.value ?? EMPTY_SEARCH}
      onApply={(next) => {
        request?.onApply(next);
        router.back();
      }}
      onClose={() => router.back()}
    />
  );
}
