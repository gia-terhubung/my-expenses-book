# Free / No ads / Offline: store slide 1 and feature graphic

Approved 2026-11-26.

## Why
The owner wants buyers to see on the first image that the app is free, has no ads and works
offline. Slide 1 is uploaded in front of the existing 6 screenshots, and the Play feature graphic
carries the same message.

## Goals / non-goals
- Goal: one new slide (`00-free`) per language (en, id, es, pt-BR) at every store size `render.sh`
  already makes, plus new Play feature graphics.
- Non-goal: changing the existing 6 shots or their captions.
- Anti-goal: claims that are not true. The app uses the network for exchange rates and the
  optional tip jar, so the slip says "Internet optional", and nothing says "forever".

## Approaches
- Three icon cards under the header: rejected, generic card-kit look.
- Feature graphic with only a big headline (B): rejected, stops showing what the app does and
  repeats slide 1.
- **Picked: a "zero receipt".** A paper slip that itemises the app's cost (price 0, ads 0,
  tracking 0, account none, internet optional) with the yellow highlighter on TOTAL 0. It reuses
  the brand's existing receipt + highlighter + torn edge.

## Design
- Slide 1: the `frame.swift` header (green, Bricolage ExtraBold caption, yellow bar, torn edge),
  caption "Free. No ads. Works offline." (per language), then the slip, slightly tilted, scaled
  to fit the space under the header. Built by a new `store/screenshots/tools/promo.swift`.
- Feature graphic: `feature-graphic.swift` unchanged in layout; it is fed the zero-receipt lines
  instead of the grocery slip, and the subtitle becomes the caption (wraps if needed).
- Text: caption in `captions.json` as `00-free`; slip lines in `store/screenshots/zero-receipt.json`
  (`name<TAB>amount`, same format as the store-shot slips). id amounts are `0` (Rupiah has no
  decimals); es / pt-BR use `0,00`.
- Colours: existing brand only (green #1F5C4C, page #F2F5F1, yellow #FFD84A, paper).

## Left to the builder
Exact font sizes, tilt and spacing, judged on the rendered images.
