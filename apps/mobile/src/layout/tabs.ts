import type Ionicons from "@expo/vector-icons/Ionicons";

/**
 * Tab route names under (tabs); the order here is the display order. Each tab is a group with its
 * own Stack, so pages opened from a tab keep the tab bar.
 */
export const TAB_ROUTES = ["(receipts)", "(search)", "(folders)", "(settings)"] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];

export const TAB_LABEL_KEYS: Record<TabRoute, string> = {
  "(receipts)": "tabs.receipts",
  "(search)": "tabs.search",
  "(folders)": "tabs.folders",
  "(settings)": "tabs.settings",
};

/** Floating tab bar icons (Ionicons, bundled). Settings is a gear. */
export const TAB_ICONS: Record<TabRoute, keyof typeof Ionicons.glyphMap> = {
  "(receipts)": "receipt-outline",
  "(search)": "search-outline",
  "(folders)": "folder-outline",
  "(settings)": "settings-outline",
};

/** iOS native tab bar icons (SF Symbols); same order and meaning as TAB_ICONS. */
export const TAB_SF_SYMBOLS = {
  "(receipts)": "doc.text",
  "(search)": "magnifyingglass",
  "(folders)": "folder",
  "(settings)": "gearshape",
} as const satisfies Record<TabRoute, string>;
