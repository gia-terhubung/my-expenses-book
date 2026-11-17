# Ledger slip redesign: acceptance

Date: 2026-11-17. Branch: fix/device-findings. Plan: docs/superpowers/plans/2026-11-16-ledger-slip-redesign.md. Spec: docs/superpowers/specs/2026-11-16-ledger-slip-redesign-design.md (+ ui-polish.md, home-stats-design.md).
Status key: PASS / FAIL / OPEN (needs a build, another device or the owner).

## Automated gates (apps/mobile, after ce7914e)

| Check | Result | Status |
|---|---|---|
| `npx jest` | 979 / 979 passing | PASS |
| `npx tsc --noEmit` | clean | PASS |
| `npx expo lint` | 18 problems (4 errors, 14 warnings), unchanged baseline from before M5 | PASS (no new) |
| `npm run check:pii` | ok, 68 dump tokens, none found | PASS |
| Backup crypto tests under parallel load | `container.test.ts` / `exportBackup.test.ts` can time out (~30 s) when several jest runs share the machine; pass alone | OPEN (test robustness, final review) |

## Device pass, Redmi 14C (Android, 360 dp, Indonesian, synthetic data), 2026-11-17

Captured over wireless adb with the dev build; every capture guarded to the app in front. Owner settings restored after each run.

| # | Check | Result | Status |
|---|---|---|---|
| D1 | Feed slip, light and dark | green slip, torn edge, yellow total bar, pace line, category strip + legend, "Lihat statistik ›"; green status strip with light icons; list stays light | PASS |
| D2 | Floating duo bar, gesture navigation | floats 12 dp above the gesture handle; list scrolls underneath; active tab tonal pill | PASS |
| D3 | Floating duo bar, 3-button navigation | floats above the 47 dp button bar | PASS |
| D4 | + opens the add sheet from any tab | Feed, Settings: sheet with grab handle, "Pindai struk" solid green | PASS |
| D5 | Tab screen-reader labels | content-desc exactly "Struk", "Cari", "Folder", "Pengaturan" (no icon glyph) | PASS |
| D6 | Font scale 2.0 | slip totals shrink to one line; day number one line; month total whole; Statistik readable; tab labels shrink, not "…" | PASS |
| D7 | Landscape (side rail) | slip in the list pane, detail pane dark/light correct, Home FAB present | PASS |
| D8 | Statistik Bulan / Tahun pajak, light and dark | totals, pace, receipt count, compact bar labels ("Rp 12,1 jt"), categories with separate Lainnya / Tanpa kategori, top merchants, trips & projects | PASS |
| D9 | Search "Belum dikonversi" filter via `search?unconverted=1` | chip shown, filter applied (0 receipts: all currently converted) | PASS |
| D10 | Settings, export, backup, folders, search screens light/dark | restyled buttons, cards, inputs; nothing under the status bar or the floating bar | PASS |
| D11 | Dev-only: "configured linking in multiple places" LogBox toast after changing font scale (activity recreate) | not shown in release builds; no extra NavigationContainer in app code | OPEN (final review) |

## Open items

- New app icon ("Long page", yellow) and the iOS `assets/expo.icon` bundle: verify on the next EAS build (native assets; hand-written icon.json).
- iOS: nothing verified on an iPhone yet (no device run in this pass).
- Z Flip 6 fold/unfold rows: deferred by the owner to before ship.
- Final whole-branch review on the most capable model: pending (subagent weekly limit until 2026-11-20 16:00 WIB), plus triage of the deferred minors in the SDD ledger.
- Bulk exchange-rate screen: v1.1 (docs/m5-followups.md).
