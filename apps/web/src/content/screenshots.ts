/**
 * App screenshots shown on the landing page.
 *
 * Source captures: iPhone 16 Pro Max simulator, 1320x2868 PNG, light mode,
 * English, synthetic seed data only. They go in `screenshots-src/<id>.png`
 * and `npm run screenshots` writes `public/screenshots/<id>.webp` (780x1695).
 *
 * While `ready` is false the site draws a clearly marked placeholder in the
 * same phone frame. Set `ready: true` once the .webp file is committed.
 */
export type ShotId = "home-slip" | "capture" | "review" | "receipt-detail" | "statistics" | "tip-jar";

export type Shot = {
  id: ShotId;
  /** Alt text for the real image. Describes what the screen shows. */
  alt: string;
  /** Short name of the screen, shown on the placeholder. */
  screen: string;
  ready: boolean;
};

export const SHOT_WIDTH = 780;
export const SHOT_HEIGHT = 1695;

export const SHOTS: Record<ShotId, Shot> = {
  "home-slip": {
    id: "home-slip",
    screen: "Home",
    alt: "The home screen: a green slip with this month's total, and the receipts of the month listed below it.",
    ready: false,
  },
  capture: {
    id: "capture",
    screen: "Add a receipt",
    alt: "The Add a receipt sheet with three choices: Scan receipt, Import from Photos and Add manually.",
    ready: false,
  },
  review: {
    id: "review",
    screen: "Review receipt",
    alt: "The Review receipt screen with merchant, date, total, tax, currency and category filled in, and one field marked Check this.",
    ready: false,
  },
  "receipt-detail": {
    id: "receipt-detail",
    screen: "Receipt detail",
    alt: "A saved receipt in a foreign currency, with its photo, the converted amount and the exchange rate of the purchase date.",
    ready: false,
  },
  statistics: {
    id: "statistics",
    screen: "Statistics",
    alt: "The Statistics screen: this month's total, the last six months as bars, and spending by category.",
    ready: false,
  },
  "tip-jar": {
    id: "tip-jar",
    screen: "Tip jar",
    alt: "The Tip jar screen, offering an espresso, a black coffee or a cappuccino for the developer.",
    ready: false,
  },
};

export function shotSrc(id: ShotId): string {
  return `/screenshots/${id}.webp`;
}
