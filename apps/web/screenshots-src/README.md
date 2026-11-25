# Screenshot sources

The landing page uses the English captures from the store screenshot run, not files in this folder.

Sources: `store/screenshots/raw/<device>/en/<scene>.png`, made by `store/screenshots/tools/capture-ios.sh`
(synthetic seed data, light mode, never real receipts).

| Web file (`public/screenshots/`) | Source | Web size | Used in |
|---|---|---|---|
| `review.webp` | `iphone/en/01-review.png` (1320x2868) | 780x1695 | hero |
| `home.webp` | `iphone/en/02-home.png` | 780x1695 | story |
| `zoom.webp` | `iphone/en/03-zoom.png` | 780x1695 | story |
| `stats.webp` | `iphone/en/04-stats.png` | 780x1695 | story |
| `trip.webp` | `iphone/en/05-trip.png` | 780x1695 | story |
| `search.webp` | `iphone/en/06-search.png` | 780x1695 | story |
| `duo-outer-home.webp` | `duo-outer/en/02-home.png` (1398x2034) | 560x815 | fits your screen |
| `duo-inner-home.webp` | `duo-inner/en/02-home.png` (2007x2853) | 900x1279 | fits your screen |

After a new store run, `npm run screenshots` rewrites all eight. The sizes must match `DEVICE_SIZE` in
`src/content/screenshots.ts`.
