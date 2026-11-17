/** Facts about the site and its publisher. One place, used by pages, metadata and legal text. */
export const SITE = {
  name: "My Expenses Book",
  url: "https://meb.terhubung.app",
  description:
    "Scan receipts into searchable expense records. Private and offline: everything stays on your phone, with no account, no ads and no tracking.",
  contactEmail: "halo@terhubung.app",
  legalEntity: "PT Terhubung Lebih Lagi",
  country: "Indonesia",
} as const;

/**
 * Store listing URLs. `null` means "not launched yet": the site then shows a
 * disabled "Coming soon" badge instead of a link. At launch, replace each
 * `null` with the listing URL; nothing else needs to change.
 */
export const STORE_LINKS: { appStore: string | null; googlePlay: string | null } = {
  appStore: null,
  googlePlay: null,
};
