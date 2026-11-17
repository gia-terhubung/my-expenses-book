# Screenshot sources

Rules: iPhone 16 Pro Max simulator, portrait, **1320x2868 PNG**, light mode, English, synthetic seed data
(`src/dev/seed.ts`), status bar at 9:41 with full battery and no carrier text
(`xcrun simctl status_bar ... override`). Never show real receipts.

| File (in `apps/web/screenshots-src/`) | Screen | Must show | Used in |
|---|---|---|---|
| `home-slip.png` | Home (Receipts tab) | the green slip with the month total and stats line, receipts below | hero |
| `capture.png` | Add a receipt sheet | Scan receipt, Import from Photos, Add manually | step 1 |
| `review.png` | Review receipt | all fields filled, one "Check this" mark | step 2 |
| `receipt-detail.png` | Receipt detail | a foreign-currency receipt: photo, converted amount, rate of the purchase date | step 3 |
| `statistics.png` | Statistics, Month | total, last six months bars, categories | features |
| `tip-jar.png` | Tip jar | the three coffees with prices | tip jar |

`capture.png` is the add sheet, not the camera: the document scanner does not run in the simulator.

Run `npm run screenshots` to write `public/screenshots/<name>.webp` at 780x1695, quality 82.

After `npm run screenshots`, set `ready: true` for each written file in `src/content/screenshots.ts`.
