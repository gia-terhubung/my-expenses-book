# Store assets checklist

## Sizes

| Store | Asset | Size | Notes |
|---|---|---|---|
| App Store | iPhone 6.9" screenshots | 1320×2868 portrait | 3–10. Apple scales them down for smaller iPhones. |
| App Store | iPad 13" screenshots | 2064×2752 portrait | Required, because `supportsTablet: true`. |
| App Store | App icon | 1024×1024 | Comes from the build (`assets/expo.icon`). Nothing to upload. |
| Google Play | Phone screenshots | ≥1080×1920, 9:16 | Minimum 2, up to 8. |
| Google Play | 7"/10" tablet screenshots | ≥1080 short edge | Recommended (tablet and foldable support). |
| Google Play | Feature graphic | 1024×500 PNG/JPG | Needs a new design. No text near the edges. |
| Google Play | App icon | 512×512 PNG | Export from `apps/mobile/assets/images/icon.png`. |

## Screenshot capture procedure

Use synthetic data only. Never use real receipts (`spikes/receipts/` is PII).

1. Install the EAS dev build on the device or simulator.
2. Settings → Developer tools → DB check → seed the synthetic receipts (`src/dev/seed.ts`, invented merchants only).
3. Capture these screens, in EN and then in ID:
   1. Feed with month totals
   2. Review screen after a scan (fields filled, one "Check this" highlight)
   3. Folders and tax-year view
   4. Search with a filter applied
   5. Export screen (CSV/PDF)
   6. Backup & restore
   7. Unfolded / iPad two-pane list and detail
4. iOS: use the iPhone 16 Pro Max (6.9") and iPad Pro 13" simulators, which give the exact sizes. Android: capture on the Z Flip 6 or the Redmi 14C, plus the unfolded or tablet emulator for the two-pane shot.
5. Before upload, make sure the status bar shows no personal notifications or carrier name.
