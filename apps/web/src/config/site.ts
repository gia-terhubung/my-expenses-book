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
 * plain "Coming soon" text line and no badge (the official badges may not be
 * greyed out or altered). At launch, replace each `null` with the listing URL
 * and add the official badge files below to `public/badges/`.
 */
export const STORE_LINKS: { appStore: string | null; googlePlay: string | null } = {
  appStore: null,
  googlePlay: null,
};

/** Official badge artwork, supplied by the owner. Required once the matching STORE_LINKS entry is set. */
export const STORE_BADGE_FILES = {
  appStore: "/badges/app-store.svg",
  googlePlay: "/badges/google-play.svg",
} as const;
