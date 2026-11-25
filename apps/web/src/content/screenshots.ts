/**
 * App screenshots shown on the landing page.
 *
 * Source: the store screenshot run (`store/screenshots/raw/<device>/en/`), English, light mode, synthetic
 * seed data only. `npm run screenshots` resizes them to `public/screenshots/<id>.webp`; the sizes below
 * must match what the script writes (a test checks the table against the files).
 */
export type Device = "iphone" | "duo-outer" | "duo-inner";

export type ShotId =
  | "review"
  | "home"
  | "zoom"
  | "stats"
  | "trip"
  | "search"
  | "duo-outer-home"
  | "duo-inner-home";

export type Shot = {
  id: ShotId;
  device: Device;
  /** Describes what the screen shows. */
  alt: string;
  width: number;
  height: number;
};

/** Web size per device, keeping the aspect ratio of the store capture. */
export const DEVICE_SIZE: Record<Device, { width: number; height: number }> = {
  iphone: { width: 780, height: 1695 },
  "duo-outer": { width: 560, height: 815 },
  "duo-inner": { width: 900, height: 1279 },
};

function shot(id: ShotId, device: Device, alt: string): Shot {
  return { id, device, alt, ...DEVICE_SIZE[device] };
}

export const SHOTS: Record<ShotId, Shot> = {
  review: shot(
    "review",
    "iphone",
    "The Review receipt screen: the receipt photo above, with merchant, date, time, total, currency and tax filled in from it.",
  ),
  home: shot(
    "home",
    "iphone",
    "The home screen: a green slip with this month's total, the tax year total and the change against last month, with the month's receipts listed below.",
  ),
  zoom: shot("zoom", "iphone", "A receipt photo open full screen, every line of the printed receipt sharp and readable."),
  stats: shot(
    "stats",
    "iphone",
    "The Statistics screen: this month's total against last month, the last six months as bars, and spending by category.",
  ),
  trip: shot(
    "trip",
    "iphone",
    "A Tokyo trip folder: receipts in yen, each converted to dollars, with the folder total and an Export button.",
  ),
  search: shot("search", "iphone", "A search for coffee: six receipts from Blue Door Coffee across six months, with their total."),
  "duo-outer-home": shot(
    "duo-outer-home",
    "duo-outer",
    "The home screen on the folded iPhone Duo outer screen, in the phone layout.",
  ),
  "duo-inner-home": shot(
    "duo-inner-home",
    "duo-inner",
    "The home screen on the unfolded iPhone Duo, in the wide layout with a side rail.",
  ),
};

export function shotSrc(id: ShotId): string {
  return `/screenshots/${id}.webp`;
}
