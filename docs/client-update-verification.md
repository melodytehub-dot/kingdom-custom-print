# Client Update Verification

## Category Artwork

Generated asset: `public/img/category-atlas.png`.
The four-quadrant image is used as a CSS sprite for Shirts, Hoodies, Caps, and
Merch, immediately below the hero as in the supplied mobile reference.
These are generated category illustrations, not photographs of actual stock.

Generation prompt:

> Create a website category sprite atlas inspired by ONLY the four category product thumbnails in the supplied screenshot. Output one square image divided into four equal invisible square quadrants on a pure white #ffffff background. Top left: black short sleeve t-shirt shown front-on with a small tasteful off-white crown/crest graphic centered on chest. Top right: black pullover hoodie front-on with a small matching off-white crown crest on chest. Bottom left: black baseball cap three-quarter front view with small matching off-white crown crest. Bottom right: black ceramic coffee mug three-quarter view with handle on the right and an off-white ornamental crown crest print. Photorealistic studio product catalog cutouts, sharp detailed cotton fabric and ceramic surfaces, subtle grounding shadows only. Each entire object must be centered within its own quadrant with consistent 15 percent clear margin all sides, object fits within its quadrant, no clipping. Exactly four objects, one per quadrant. Do not reproduce the phone, website, border, red annotations, UI, text labels, letters or words. No divider lines, no backgrounds besides pure white. This is a single reusable web sprite atlas for four category links.

## Editor Fixes

- Toolbar has its own layout track instead of covering the canvas.
- Stage fitting respects both width and height and no longer follows a moving layer.
- Layers drag on the first gesture. A tap opens the editor only on release;
  a six-pixel movement threshold prevents finger jitter from starting a drag.
- Tapping outside any design panel dismisses it. Mobile art and other design
  panels retain a visible preview as an outside dismissal area.
- Selected layer hit area and handles render above other layer hit areas.
- Mobile resize target stays 44 CSS pixels; other actions remain in the editor.
- Pointer identity prevents a second finger from moving or ending an active drag.
- Selecting a locked element no longer silently unlocks it.
- Front and Back buttons select the actual printable garment views.
- Mobile editor scrolls as one region; actions use a three-column grid.
- Image AI toggles and graphic generation removed. Text Ideas is a local,
  template-based lettering helper; no external AI service or API key is used.

## Verification

`npm run qa-customizer-interactions` tests geometry at 35 stage sizes, overlay
ordering, touch target size, tap versus drag, drag pointer identity, proportional
resizing, cancellation, and locked-layer movement with an isolated hook harness.
These checks do not replace browser layout and touch testing.

Browser access was recovered in the earlier session. In this session the desktop
browser integration failed during initialization (missing kernel assets), so
the installed Chrome browser was exercised with Playwright instead.

## October 7 Client Reference

Primary reference: https://www.rushordertees.com/design/?method=scr&item=11565&color=39475
Secondary reference: https://www.customink.com/ndx/?PK=176104&SK=176100&prefer_singles=false

Both references were opened in Chrome. The RushOrderTees desktop and mobile
text-entry screens were inspected after dismissing its introductory overlay.

- Desktop: left tool rail and inspector, center canvas, right view controls,
  top order steps, and a persistent bottom price/save/next bar.
- Text entry: a separate entry panel, twelve selectable style presets, then
  the existing font/color/outline/arc/rotation/spacing/opacity editor.
- Artwork: file picker, file drop and clipboard image paste share the validated
  upload path. Built-in artwork and fonts now have search.
- Transforms: center snapping and alignment guides, consistent screen-size
  handles, and resize targets clamped inside the canvas.
- History: active drags stay in one undo step, and immediate undo includes an
  edit that has not yet reached the text-entry debounce timer.
- Share: exports the rendered artwork preview instead of sharing a product URL
  that does not contain the design. Uses native file sharing where supported,
  otherwise downloads a PNG.
- Landscape: tools, inspector and preview occupy separate columns to preserve
  canvas space. Portrait uses a scrollable inspector and visible preview.
- Homepage: the four supplied JPEGs replace the marked campaign row, with
  links for shirts, totes, caps and merch. Originals are retained; Next Image
  serves responsive optimized versions.

`node scripts/qa-studio-browser.mjs` exercises mouse and Chromium touch input at
1440x900, 390x844, 320x568 and 844x390. It checks tap versus drag, immediate
undo/redo, resize, rotation, panel dismissal, art search/add, front/back,
quantity/review, upload/drop/paste, draft save, preview download, cart artwork,
photo loading and horizontal overflow. Screenshots are written to the system
temporary directory as `kingdom-*.png`.

Scope boundaries: this is an implementation against our existing catalog and
order model, not an embedded copy of either commercial designer. Their licensed
art/font catalogs, sleeve printing, embroidery, multi-product/multi-color batch
orders, account-backed cloud designs, and live-agent chat are not implemented.
Image AI remains excluded as previously requested. Physical-device keyboard
behavior and OS-native share sheets still require device testing.
