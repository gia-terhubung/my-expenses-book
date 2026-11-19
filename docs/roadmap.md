# Roadmap

Last updated 2026-11-20. Based on competitor review research (2026-11-19) and owner decisions.

**First users:** people leaving paid receipt apps (Smart Receipts, SimplyWise, Expensify individuals): freelancers at tax time and travellers claiming expenses. Pitch: receipt scanning that is free, needs no account, and never loses your data.

## 1.0: launch

The app as built, plus (design: `docs/superpowers/specs/2026-11-20-v1-recurring-payday-snapshot-design.md`):

- Recurring expenses, with a per-rule "Add automatically" switch and due-day notifications for draft-type rules
- Month starts on payday (Home and Stats)
- Snapshot of the database before upgrades, restored if an upgrade fails

Launch also waits on: bank account, Paid Apps agreement, tip IAPs, store links.

## 1.0.x: fixes

Bugs and store-review issues from the first users.

## 2.0: shared household book

- Pair two phones once with a QR code; share one folder (for example "Household")
- Sync by an encrypted change file over any share channel (apart), or directly over the same Wi-Fi (together)
- Guided "move to a new phone" on the same pairing
- Test with 2–3 couples on TestFlight and Play internal testing before release

## Not planned until users ask

Widgets, debts and receivables, budgets, more than 2 people per book, cloud sync (Pro).

## Open decisions

- Android Google ML Kit (D5b): keep and disclose for now; revisit if users ask for strict zero telemetry. Run the Android OCR check (row A2) first.
