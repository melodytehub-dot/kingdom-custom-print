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
- First mobile tap selects; subsequent gestures drag after the editor settles.
- Selected layer hit area and handles render above other layer hit areas.
- Mobile resize target stays 44 CSS pixels; other actions remain in the editor.
- Pointer identity prevents a second finger from moving or ending an active drag.
- Selecting a locked element no longer silently unlocks it.
- Front and Back buttons explicitly exit the side-profile preview.
- Mobile editor scrolls as one region; actions use a three-column grid.
- Image AI toggles and graphic generation removed. Text Ideas is a local,
  template-based lettering helper; no external AI service or API key is used.

## Verification

`npm run qa-customizer-interactions` tests geometry at 35 stage sizes, overlay
ordering, touch target size, selection, drag pointer identity, proportional
resizing, cancellation, and locked-layer movement with an isolated hook harness.
These checks do not replace browser layout and touch testing.

Live browser checks were blocked by a saved local-browser permission setting,
even after approval in chat. Mobile screenshots, physical touch behavior,
software-keyboard behavior, and exact visual matching remain unverified.
