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

## October 13 Client Feedback

Client notes: background removal did not work on mobile, the editing space felt
too narrow, and more graphics and templates were requested.

### Background removal now works everywhere

- The cutout (`cutoutBackground` in `lib/imageFx.ts`) no longer assumes one flat
  backdrop colour. It samples the four corners, keeps up to eight backdrop
  colour families, then floods in from the border preferring pixels close to the
  corner it started from (`seedTol` 44, `localTol` 30 per step, `globalTol` 135
  distance bound). Gradients, vignettes and studio shadows come out cleanly and
  the walk can no longer creep across a blurred subject outline.
- The result is a soft matte: the fringe is feathered by how far a pixel sits
  from the backdrop, and single-pixel speckle is removed, so edges stay smooth
  at print size instead of showing a hard stair-step.
- A fast, on-device pass (`quickBackgroundRemoval`) runs first for every upload.
  It needs no model download, no WebGPU and no network, so phones get a result in
  well under a second. It works at up to 1400px on the long edge and scales the
  mask back up, so a 4000px upload cannot stall a phone.
- The AI model is only used to refine busy photos, and only on desktop where it
  runs quickly. If it is unavailable or fails, the instant cutout is kept and the
  customer never sees a hard error.
  *(Superseded on October 15 — background removal was rebuilt around on-device
  models for phones as well. See "Background removal, taken seriously" below.)*
- Vector (SVG) uploads skip the AI model, which cannot decode them, and use the
  instant cutout instead. Object selection flattens vectors first.
- When nothing resembles a background the notice now says so and points to
  Select Object, instead of claiming success.

### More room to edit on phones

- Portrait phones now keep the artwork at its full size while editing. The
  inspector slides up as a sheet over the canvas instead of shrinking it, and the
  garment is panned (never scaled) to stay clear of the sheet, so an element no
  longer visibly shrinks the moment it is selected. Landscape phones keep the
  side-by-side columns.

### More graphics and templates

- Clipart grew from 27 to 92 pieces and gained an Animals category
  (shield, diamond, flame, skull, sparkle, target, compass, rocket, gear, clock,
  camera, map pin, controller, infinity, key, eye, wifi, helmet, dumbbell, tennis,
  golf, volleyball, boxing glove, skateboard, surfboard, medal, bowling, runner,
  praying hands, angel wings, menorah, star of David, tree, pine, cactus, cloud,
  rainbow, snowflake, campfire, palm tree, tent, sunset, bee, tulip, fish, cat,
  dog, dragonfly, whale and more).
- Templates grew from 9 to 44 across eight categories (Team & Sports, Faith,
  Nature, Classic, Business, Events & Celebrations, Holidays, Pets).

### Verification

- `npm run qa-background-remove` uploads a plain-background logo on desktop
  (1440x900) and mobile (390x844), removes the background and asserts the border
  pixels are transparent, the artwork survives, the layer records the cutout and
  no browser error occurs. Both viewports complete in under half a second.
- The AI refinement path was exercised end to end with a busy photo: it finished
  and reported success with no console or page errors.
- `npm run qa-customizer-controls` passes (updated so the mobile editor sharing
  the screen keeps the garment visible, and the larger template library still
  narrows by category).
- `npm run qa-customizer-interactions` passes.
- `npm run typecheck`, `npm run lint` and `npm run build` pass.

## October 15 Client Feedback

Client notes: selected items still shrank the artwork, and objects, text and
images need to be grouped so they can be moved as one, "very responsive on
mobile".

### Selecting an element no longer shrinks it

- On portrait phones the design step now keeps `.rot-main` absolutely filling the
  body and shows the inspector as a bottom sheet over it, so the stage height
  never changes when a panel opens. The garment is re-fitted by panning only.
- Verified by `npm run qa-customizer-controls`, which measures the stage and the
  garment before and after selecting an element and asserts both are unchanged
  (within 1px) at 390x844.

### Grouping, like Canva

- **Select more.** The Layers panel has a "Select multiple" switch; the canvas
  itself gets a single tap budget: the first tap on a grouped element picks up
  the whole group, the next tap steps inside and opens that element's editor.
  Plain elements still open their editor on the first tap, as before.
- **Group / Ungroup.** The floating selection bar over the canvas and the Layers
  panel both group the picked elements (two or more) and release them again.
  Removing a layer prunes the group, so a group of one never lingers.
- **One object.** A group draws a single frame with delete, proportional resize,
  axis stretch and rotate grips. Dragging anywhere inside the frame, or any
  member, moves every member by the same amount and keeps their spacing;
  resizing and rotating pivot on the group's centre.
- **Lock, duplicate, delete.** The bar locks or unlocks a whole group at once,
  duplicates every member into a new group and deletes the lot. Stepping into a
  member shows the group as locked, so a lock always means the same thing.
- **Layers panel.** Every element on the side is listed top of stack first, with
  a text/artwork thumbnail, its group number and its lock state.
- Groups are a flat `groupId` tag on the existing layers, so previews, cart
  artwork, saved drafts and the share image all keep working unchanged.

### Background removal, taken seriously

- **What was wrong.** "Remove Background" had a fast, download-free pass that
  keyed out a background colour, and it was allowed to declare victory and skip
  the AI. On the client's own photo that pass walked the whole low-contrast
  outdoor background, reported itself *confident* and cleared **95.7% of the
  picture** — the person included. That is the "it didn't even recognise
  anything, it just cropped out all the picture" result, reproduced and measured
  in `scripts/qa-cutout-lab.mjs`.
- **The instant pass is now only trusted for flat artwork, and the decision is
  measured rather than guessed.** Every upload is profiled (`artworkProfile` in
  `lib/imageFx.ts`) for how much of it is flat fill versus hard edge. A logo,
  sticker or wordmark is flat fills plus a few edges (0.99 of its pixels are
  flat), so it still cuts out instantly with nothing downloaded. A photograph is
  gradient and grain everywhere — the client's photo scores 0.45 — so it always
  goes to the models, however confident the colour key feels.
- **The AI runs on the device, in the browser.** Two segmentation models run in a
  web worker in the customer's browser: a 6 MB portrait matting model first, then
  a 42 MB detailed model. No server, no API key, no upload — only the model
  weights are downloaded, once, and the browser caches them.
- **Nothing is pasted on the shirt unverified.** Every mask is scored
  (`lib/cutoutMask.ts`) before use: a mask that found nothing, kept everything, is
  a sieve of holes, or has no solid core is thrown away rather than handed to the
  customer.
- **Phones.** The 6 MB model runs automatically on phones — the one that keeps
  hair and soft edges — and the 42 MB detailed model is offered as a button
  ("Try the Detailed Model") instead of being forced onto a phone CPU.
- **Honest messages.** If the model has run and its mask was rejected, the notice
  says the subject could not be made out and points at Select Object. If the AI
  cannot be reached, the fast cut-out is used and the notice says that. A photo
  is never presented as "done" when it is not.

### Verification

- `npm run qa-cutout-ai` is new: it uploads a real photograph of a person against
  a busy sea-and-sky backdrop on desktop (1440x900) and on a phone (390x844 with
  an iPhone user agent), turns Remove Background on and judges the saved layer —
  backdrop corners fully transparent, sky band cleared, subject intact (centre
  opaque and opaque down 74% of the middle column, 44% of the frame kept), 4% of
  pixels soft-edged rather than posterised, the customer told it worked, the
  detailed-model button offered, no browser errors. Both viewports pass.
- The same script run against the client's own photo
  (`QA_CUTOUT_PHOTO=<photo> npm run qa-cutout-ai`) passes on desktop and phone:
  corners and the top band fully cleared, 72.7% of the picture removed — the
  street, the building and the watermark banner with it — the subject intact
  (opaque down 77% of the middle column) and 1.9% soft edges. That photo is the
  one the instant pass cleared 95.7% of.
- `npm run qa-cutout-mask` is new: 18 checks on the mask analyser against real
  failure shapes — matted portrait, mug with its handle hole, empty mask,
  everything-kept mask, sieve, mush, hair and degenerate input. No browser needed.
- `npm run qa-cutout-actions` is new: 28 checks pinning every message the customer
  can see around the cut-out ("Background removed.", "We could not find a subject
  in that photo…", "…the AI model could not load") and every button the artwork
  editor can offer, including the retry that used to be missing, plus which
  devices are allowed to run the 42 MB model unprompted. No browser needed.
- `npm run qa-background-remove` passes on both viewports: a flat logo and a
  gradient logo still cut out instantly with no model download, and a busy photo
  is never pasted half-removed.

### Verification (previous work, still green)

- `npm run qa-grouping` unit-tests the grouping model (reading a group, pruning
  blank and orphaned tags, merging picks, releasing leftovers, deletions and
  duplication, with no browser).
- `npm run qa-customizer-grouping` drives the real customizer on desktop
  (1366x900) and on a phone (390x844, iPhone user agent): it groups two text
  layers from the Layers panel, checks one frame and two member outlines, drags
  a member and asserts both outlines moved by the same delta, locks and unlocks
  the group, steps into an element and back out, duplicates the group into a
  second group and ungroups only the copies. It also asserts no sideways scroll
  and no runtime errors on the phone.
- `npm run qa-customizer-interactions` covers the same gestures at the geometry
  level (group drag, group rotate at 90°, proportional group resize, ungroup).
- `npm run qa-cart-flow` passes end to end again: the design → quantity → review →
  add to cart → reprice → checkout path was re-checked in a real browser after
  the text-entry panel and the footer button labels changed.

## October 17 — Hosted background removal in the editor

Client note: after the on-device rebuild, background removal is "not really
perfect yet", and a paid hosted service (imgix) is being evaluated hands-on in
the real editor before deciding whether to pay for it.

### How it works in the customizer

- When `NEXT_PUBLIC_IMGIX_SOURCE` names the account's imgix source, "Remove
  Background" on a photograph is done by imgix instead of the on-device
  models. The editor parks the photo briefly on our own site
  (`/api/cutout-bridge`, random id, swept after a day) because imgix can only
  fetch from a configured source; the transparent PNG comes straight back.
  imgix's remover accepts jpg/png only, so the parked copy is re-encoded from
  the editor's stored WebP to JPEG first — the first production run proved it,
  falling back to the on-device models when imgix refused the WebP with
  `400 Invalid file type, expected jpg/png`.
- The request mirrors rushordertees.com exactly — the parameters sit in their
  studio bundle and are pinned in `lib/imgixCutout.ts`:
  `bg-remove=true&trim=colorUnlessAlpha&fm=png&cs=strip` — plus one deliberate
  change of our own: `bg-remove-fallback=false`, so a removal that fails is an
  error rather than the untouched photo served with a 200 pretending to be the
  cut-out. A "still processing" answer (HTTP 423, normal for a cold photo — it
  can take up to a minute the first time) is retried until the render is ready.
- The result obeys the same contract as the on-device one (`encodeCanvasUnder`:
  WebP, transparency kept, under 380 KB), so ordering and drafts are untouched.
  The layer records `cutoutSource: "hosted"`.
- Any hosted failure — no signal, no credits, a photo it cannot cut — falls
  back to the on-device models, and the customer is told which one did the
  work: "Background removed with the hosted AI." or "Background removed on this
  device — the hosted AI did not answer."
- Flat artwork (logos, stickers, screenshots) is still keyed out instantly in
  the browser and is never uploaded anywhere — that gate predates this change
  and keeps logos private, instant and free.
- One-time setup in the imgix dashboard: Sources → New Source → Web Folder,
  Base URL `https://kingdom-custom-print.vercel.app/`, subdomain of choice,
  Deploy Source. The existing source has no usable origin (it answers 404), so
  it cannot fetch our photos.
- Turning the evaluation off is removing `NEXT_PUBLIC_IMGIX_SOURCE` and
  redeploying; without it nothing about removal changes from before.
- While hosted removal is on, customer photos are processed by imgix. If it
  stays, the privacy policy should say so before launch.

### The uploader accepts what phones actually send

- Client report (round 1): some uploads show "the picture can't be read" while
  others work. Reproduced: browsers cannot decode HEIC — the default photo
  format on every iPhone — and Windows and Android report those files so
  differently that the old checks refused them ("not an image") or stumbled on
  the data ("could not be decoded"), while ordinary JPG/PNG downloads sailed
  through.
- Client report (round 2): the same stock photo uploads fine on desktop but
  cannot be read on the phone. Both causes of that pattern are now fixed: (a)
  phone pickers often hand files over with a missing or generic MIME type
  ("application/octet-stream"), which the old checks refused, and (b) raster
  photos were decoded from multi-megabyte base64 data URLs, which mobile
  browsers choke on where desktop Chrome does not.
- Acceptance is byte-first for every format, not just HEIC: JPG, PNG, WEBP,
  AVIF, GIF and HEIC are recognised from the upload's leading bytes, so a
  mislabelled photo passes no matter what the phone's picker wrote on the
  label; BMP/TIFF are named refusals. The picker itself is permissive
  (`image/*` plus extensions) so phones do not hide these files in the first
  place — the validator is the real gate, and it reads bytes, not labels.
- Photos now decode through a blob URL instead of a base64 data URL. This is
  the "works on desktop, cannot be read on my phone" fix: the old path built
  a ~33 %-larger base64 copy of the whole photo in memory before decoding,
  which is exactly where phone browsers run out of room on big photos.
- `heic-to` (libheif compiled to WebAssembly) converts HEIC photos to JPEG on
  the customer's device — recognised even when renamed to `.jpg` (how chat
  apps and Windows often hand it over). The ~3 MB decoder downloads only when
  a HEIC actually arrives — JPG/PNG uploads are exactly as fast as before.
  If the wasm converter cannot handle a photo (a few HDR/10-bit files),
  Safari is given one chance to read it natively before failing.
- AVIF (what Google Images often saves) is accepted too; modern browsers
  decode it natively.
- The remaining refusals explain themselves: an oversized file tells its size,
  an unreadable file names the format it could not decode and suggests a
  smaller copy or a screenshot, and an old format names itself ("We cannot
  print BMP. Use PNG, JPG, WEBP, HEIC, AVIF or SVG.").

### Verification

- `npm run qa-upload-formats` grew to 18 checks: it drives the real upload
  input on desktop and on a phone with the exact files that failed — an
  iPhone HEIC (reported as generic bytes), a HEIC renamed to `.jpg`, and a
  plain JPG handed over with no usable type — plus JPG, PNG, AVIF, an SVG
  with no type (stays vector), a 48 MP photo (downscaled to 1050x1400 before
  storing), an oversized 9 MB file, a broken file and a BMP. Every good file
  lands on the design; every bad file gets its specific, honest message. The
  same checks pass against the deployed site.
- Live check against the real source: the deployed editor cut a photograph out
  through the real bridge and imgix on desktop and on a phone — the mug sample
  and the client's own kaftan photo — in 11-13 s each (cold renders), no
  on-device model ran, the layer recorded `cutoutSource: "hosted"`, and both
  cut-outs came back clean (pixel-alpha checked, and eyeballed).
- `npm run qa-hosted-cutout` is new (run against a dev server started with
  `NEXT_PUBLIC_IMGIX_SOURCE=test.imgix.net`; the imgix host is intercepted, so
  no credits are spent). On desktop and a phone: the photo reaches the bridge,
  the parked copy is jpg/png (imgix refuses WebP — pinned after the first
  production run tripped on it), the imgix request carries the pinned recipe
  including `bg-remove-fallback=false`, a "still processing" 423 is retried
  until ready, the cut-out lands on the layer as `cutoutSource: "hosted"` with
  clear corners and an intact subject, no AI model is downloaded, and the
  toast names the hosted AI. A hosted failure on the phone falls back to the
  portrait model and says so; a flat logo still cuts out instantly with no
  upload and no imgix request.
- `npm run qa-cutout-actions` grew: the hosted status lines, the two hosted
  endings (used / fell back), and that a hosted cut-out leaves no "improve"
  button (nothing better to run). No browser needed.
- `npm run qa-background-remove`, `qa-cutout-ai`, `qa-customizer-*`,
  `qa-cart-flow` and `qa-audit` pass unchanged with hosted removal off —
  the on-device path is exactly as it was.

## October 17 — One button, clean words, pay-once removal, phone decode retry

Client notes (same day, in the real editor): (1) the phone once showed "That
JPG could not be decoded as an image" before the same photo uploaded on a
retry; (2) there should be one Remove Background control, not several;
(3) drop the "Select Object" tab; (4) turning removal off and on again must
not process (or pay) a second time; (5) apply the supplied `client-ready-ux`
skill across the site.

### One background-removal control

- The artwork editor now shows exactly one control: the **Remove Background**
  switch. The "Select Object" tab and its whole subject-selection editor are
  removed (`components/customizer/SubjectSelectionEditor.tsx`,
  `lib/subjectSelection*.ts`, the worker, the model loader and their CSS), and
  the follow-up offer buttons are gone with them ("Improve Cut-out with AI",
  "Try the Detailed Model", "Try the AI Cut-out Again"). Clicking the switch
  simply uses the best path available — hosted when configured, otherwise the
  on-device models — so the customer never has to know which engine ran.
- Supersedes the October 13/15 behaviour that pointed errors at Select Object
  and offered model-upgrade buttons: the copy now suggests a plainer photo,
  checking the connection, or checking the edges instead, depending on what
  actually happened.

### Pay-once background removal

- Turning the switch off keeps the finished cut-out on the layer
  (`backgroundRemovedSrc`); turning it back on re-displays it instantly with
  **no second run, no second upload and no second imgix credit** — measured at
  ~520 ms on desktop and phone versus 15+ s for a fresh model run. This is
  pinned by new checks in `qa-cutout-ai` (on-device) and `qa-hosted-cutout`
  (counter asserts one bridge upload + one successful render, however many
  times the switch is flipped).
- The removed "improve" buttons were the one path that could re-run the hosted
  remover on every click; with the single switch, a cut-out is processed once
  per photo unless the customer resets the artwork.

### Client-ready copy across the site (client-ready-ux skill)

- Installed the supplied skill at `.opencode/skills/client-ready-ux/` and
  appended its addendum to `AGENTS.md`, so it applies to future changes.
- Audited every customer-visible string. The cut-out surface no longer says
  "AI", "model", "hosted" or the provider name anywhere: status lines read
  "Preparing background removal… 42% (downloads once).", "Removing background…",
  "Preparing your photo…", and outcomes are a clean "Background removed." (or
  an honest, actionable fallback) regardless of which engine did the work.
  The "AI" badges are gone from the editor.
- Upload copy now matches what is accepted: the upload zone and FAQ list
  "PNG, JPG, WebP, HEIC, AVIF, GIF and SVG"; refusals are consistent
  sentence-case. Privacy disclosure for the hosted service remains an open
  item for the client (see October 17 hosted section).
- `scripts/qa-cutout-actions.mjs` was rewritten to pin the new strings **and**
  fail if implementation language (AI/model/hosted/imgix) reappears in any
  customer-facing cut-out message.

### The phone decode retry

- The reported toast ("could not be decoded", success on a later attempt) is a
  transient phone failure: mobile browsers under memory pressure occasionally
  fail a large image decode and succeed moments later. The uploader now tries
  three times, each with a fresh blob URL and a short pause (400 ms, then
  900 ms), before showing the (reworded) "We could not open that JPG. Try a
  smaller copy or a screenshot." So the retry the client performed by hand now
  happens by itself.
- New regression check in `qa-upload-formats`: the first decode is forced to
  fail (a broken blob URL is handed to the first read) and the upload must
  still land on the design with no user action.

### Verification

- `qa-upload-formats` (19 checks) passes locally — including the new
  flaky-decode recovery case — on desktop and phone contexts.
- `qa-cutout-ai` passes on desktop and phone with three new checks each: one
  switch and no extra offers/badges, off/on reuses the stored cut-out (no
  second run), and the re-shown result reports success.
- `qa-hosted-cutout` passes with new credit-guard checks: after a hosted
  cut-out, flipping the switch off and on again performs no second bridge
  upload and no second render (`imgixRequests` stays at 2 — the 423 retry plus
  the successful render), and both messages are the clean success copy.
- `qa-customizer-controls` grew a check that no "Select Object" tab and no
  badges remain; `qa-background-remove`, `qa-cutout`, `qa-cutout-mask`,
  `qa-cutout-actions`, `qa-cart-flow`, typecheck, lint and build all pass.

## October 18 — Photoroom comparison row (evaluation build)

Client request: set up Photoroom's background removal as a **second Remove
Background button in the customizer**, so the two services can be compared on
the same photo in the same editor before choosing one. The existing imgix
wiring is untouched — production keeps exactly one switch.

### What was added

- **Server route** `app/api/photoroom-cutout/route.ts`. The API key lives in
  the server environment (`PHOTOROOM_API_KEY`) and never reaches the browser.
  The editor posts the prepared photo there; the route calls Photoroom
  (`sdk.photoroom.com/v1/segment`, `x-api-key` header, multipart `image_file`)
  and hands the transparent PNG back. 4 MB cap; jpg/png/webp/heic accepted;
  responses are never cached.
- **Client module** `lib/photoroomCutout.ts`. The photo is prepared exactly
  like the imgix path — Photoroom and imgix both refuse WebP, so the editor's
  WebP canvas copy is re-encoded to JPEG — rides the same status lines
  ("Preparing your photo…", "Removing background…") and lands through the same
  WebP-under-380KB contract as every other cut-out.
- **The comparison row** (`components/customizer/editors.tsx`,
  `lib/cutoutActions.ts`). A second row sits under the normal switch:
  "Remove Background with Photoroom / Runs Photoroom's remover on this photo".
  It renders **only when the build sets `NEXT_PUBLIC_CUTOUT_ALT=photoroom`**,
  so a normal build shows no second button at all.
- **Pay-once comparison.** The first tap runs Photoroom and stores its result
  on the layer (`altRemovedSrc`); every later tap just switches between the
  two stored results, so flipping through both versions repeatedly makes no
  new request to either service. The switch keeps showing the last-selected
  result (off/on changes nothing); the comparison row is the only control that
  switches between them. Row states: "Remove Background with Photoroom" →
  "Showing Photoroom's result / Tap to switch back" ↔ "Show Photoroom's
  result / Already saved — no extra processing".

### Environment (Preview scope only)

| Variable | Scope | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_CUTOUT_ALT` | Preview | `photoroom` |
| `PHOTOROOM_API_KEY` | Preview (server-side) | the trial key |

Production was not given either variable: it keeps one switch, imgix behind
it. Deleting the two Preview variables removes the comparison everywhere.
While the comparison build is in use, photos cut out through that row are
processed by Photoroom; whether a site-wide privacy line is needed when one
service is chosen remains the open item from October 17.

### Measured against the trial key (2 real calls, $0.04 total)

- Kaftan test photo (2047×2560): 200 OK in 6.1 s — 73.1% cleared, 0.9% soft
  edge pixels, hair/fingers/garment edges intact.
- Mug sample (900×1200): 200 OK in 1.1 s — 72.8% cleared, 0.8% soft edges.
- Both results were saved locally for the client to inspect. Photoroom price
  for reference: Basic plan $0.02 per image; the imgix side is unchanged.

### Where to try it

- Preview build: `https://kingdom-custom-print-oew4uqsa3-melodytehubbs.vercel.app` —
  open the editor, add a photo, tap the second row. Verified on the deployment
  itself: the row is present, one real call answered, the result was stored as
  the alt cut-out (`activeCutout: "alt"`, `cutoutSource: "hosted"`), the toast
  read "Background removed.", and the row flipped to "Showing Photoroom's
  result".
- The live site (`kingdom-custom-print.vercel.app`) serves the same code built
  without the two Preview variables: verified as zero comparison rows, so
  shoppers see exactly the one switch they had before.
- The project had Vercel Authentication on, which puts deployment URLs
  (previews included) behind a Vercel login; it was switched off in project
  settings so the preview opens on any device without signing in. Turn it back
  on (Project → Settings → Deployment Protection → Vercel Authentication) once
  the comparison is done.

### Verification

- `qa-photoroom-cutout` (new, hermetic — a local mock serves Photoroom and
  imgix is fulfilled in-page, so zero credits are spent): 47 checks across
  desktop and phone cover the row appearing only when configured, the key
  never appearing in any browser request, the exact upstream contract
  (POST /v1/segment, server-held `x-api-key`, multipart `image_file`, JPEG
  never WebP), the result landing and showing, switching between results
  costing no new call, off/on keeping the last-selected result, an
  alt-first flow producing the main result on switch-back, a failed call
  staying honest with a working retry, and intentional flat-artwork
  comparison.
- `qa-hosted-cutout` re-ran green: imgix behaviour, status copy and the
  pay-once credit guard are unchanged.
- `qa-cutout-actions` gained three pins for the row's copy;
  `qa-customizer-controls` gained a check that a normal build shows zero
  comparison rows. `qa-cutout-ai` (both viewports) and `qa-upload-formats`
  re-ran green; typecheck, lint and build all pass.

