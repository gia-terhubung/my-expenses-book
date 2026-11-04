/** Tab route names under (tabs); the order here is the display order. */
export const TAB_ROUTES = ["index", "search", "folders", "settings"] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];

export const TAB_LABEL_KEYS: Record<TabRoute, string> = {
  index: "tabs.receipts",
  search: "tabs.search",
  folders: "tabs.folders",
  settings: "tabs.settings",
};
