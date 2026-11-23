# Receipt photo: bigger inline, real zoom everywhere

Date: 2026-11-23. Status: approved by the owner.

## Intent

The owner opens a receipt to see what was bought. The photo is too small to read and has to be zoomed every
time. On Android it cannot be zoomed at all: the full-screen viewer uses `ScrollView.maximumZoomScale`,
which React Native supports on iOS only. Item-list extraction was considered and parked; reading the photo
comfortably is the need.

## Goals

- A receipt's item lines are readable in two taps or fewer, on iPhone, Android, the iPhone Duo (closed,
  open, sideways), foldables and tablets.
- The inline photo is larger and higher on the receipt screen.
- The full-screen viewer zooms the same way on iOS and Android.

## Non-goals

- Swiping between pages in full screen; rotating or cropping the photo; showing the scanned text.
- Placing the photo on the Duo hinge (stays in foldable "phase 2").

## Anti-goals

- Hiding the photo's existence or making the screen feel like a photo app; the receipt data stays first.
- A new native dependency.

## Approaches

- A. Bigger inline photo only. Easy; text stays small and Android zoom stays broken.
- B. Fix full screen only. The photo stays buried at the bottom.
- **C. Both (chosen by the owner).**

## Design

### Inline photo (receipt detail, `src/receipts/ReceiptDetail.tsx`)

- Moves directly under the Edit / Move / Delete row.
- Full content width (the screen's 640 pt cap still applies).
- Height capped at 55 % of the window height instead of a fixed 360 pt, so it scales with short windows
  (Duo sideways, tabletop, landscape tablet). Never below 240 pt.
- When a tall page hits the cap, it shows the top of the page at full width (crop, top aligned), with a
  soft fade at the bottom edge. A small expand icon in the corner marks it as tappable on every page.
  The total is shown above, so the crop hides nothing the screen needs.
- Multi-page receipts keep stacking pages.

### Full screen (shared `PageViewer`, also used by the review form)

- Opens fitted to the screen.
- Double-tap zooms to 2.5x around the tapped point; double-tap again returns to fit.
- Pinch zooms 1x to 5x around the pinch focal point; drag pans when zoomed; the image is clamped so it
  cannot be dragged off screen; releasing a pinch below 1x springs back to fit.
- Built with react-native-gesture-handler and Reanimated (already installed). Same on iOS and Android.
- Window size change while open (fold, unfold, rotate): viewer stays open, re-fits, zoom resets.
- Done button keeps its safe-area placement.
- Accessibility: the existing "Open photo" labels stay; the zoom surface offers "Zoom in" and "Zoom out"
  accessibility actions.
- Reduced motion: zoom changes apply without animation.

## Left to the builder

- Exact fade height and icon glyph; spring/timing values; how the crop is drawn in expo-image
  (`contentFit="cover"` with `contentPosition="top"`).
