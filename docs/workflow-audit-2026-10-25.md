# Kingdom Custom Print workflow audit

Date: October 25, 2026  
Stack verified: Next.js 16.4.3, React 19.3, TypeScript, PostgreSQL, Stripe Checkout contract mocks  
Safety: no database reset or seed was run; no live Stripe charge was made. Database-backed checks created uniquely named fixtures and removed those exact records.

## Status legend

- **Confirmed / fixed**: reproduced in code or browser, corrected, and covered by a passing check.
- **Confirmed / documented limitation**: behavior is accurate and safe, but a production capability still needs a business choice or external service.
- **Configuration-dependent**: cannot be truthfully called complete without the client credential, policy, supplier data, or deployed service.

## Issue register

### 1. Public order references exposed private order data — Confirmed / fixed

- **Trigger:** Open `/order/{reference}` or `/order/success?ref={reference}` without an account session.
- **Expected:** A reference alone may reveal a low-detail status, never email, address, artwork, notes, totals, or line items.
- **Observed:** The reference was sufficient to load `OrderDetail`, including private customer and design data.
- **Cause:** Both pages called the full-order query without an ownership or guest-verification boundary.
- **Fix:** Added low-detail public status queries, signed-in ownership checks, rate-limited reference-plus-checkout-email recovery, hashed 24-hour guest access tokens, and httpOnly cookies.
- **Verification:** `qa-order-privacy` passes reference-only denial, exact-email guest recovery, and owner access. The temporary order is deleted afterward.

### 2. Email and payment-instruction promises had no delivery service — Confirmed / fixed copy; provider-dependent delivery

- **Trigger:** Read tracking, success, contact, and order copy or submit the contact form.
- **Expected:** The site must describe only messages it can actually send.
- **Observed:** Copy promised confirmation/payment emails even though the repository contains no transactional email transport; contact used `mailto:` without explaining it.
- **Cause:** Marketing copy had drifted ahead of implementation.
- **Fix:** Removed automatic-email promises. Contact now explicitly prepares a message in the visitor's email app and disables itself when the business has no published contact email. Order recovery works on-site.
- **Verification:** Contact, tracking, success, and order pages were reviewed in the responsive audit. A transactional provider remains intentionally unconfigured.

### 3. Payment creation, replay, refund, and status transitions needed hard boundaries — Confirmed / fixed

- **Trigger:** Repeat Checkout submission, fail Session creation, replay a webhook, refund a charge, or change an order in admin.
- **Expected:** One checkout attempt produces one pending order; only signed Stripe paid events confirm payment; replays are idempotent; admins cannot turn an unpaid order into paid; all transitions are auditable.
- **Observed:** Checkout had no explicit attempt key, status movement was too permissive, and refund/cancellation evidence was incomplete.
- **Cause:** Order state was modeled as a mutable value rather than a constrained, audited workflow.
- **Fix:** Added checkout-attempt idempotency, Stripe idempotency keys, signed paid/failure/expiry/refund handlers, a status-event ledger, allowed transition maps, payment guards, full-refund handling, and failure cleanup that targets only newly created unpaid orders.
- **Verification:** `qa-payments`, `qa-checkout-idempotency`, `qa-order-transitions`, and `qa-order-payment-replay` pass. Live Stripe remains configuration-dependent.

### 4. Countries, flat shipping, tax, and returns were inconsistent — Confirmed / safe scope implemented; final policy-dependent

- **Trigger:** Compare checkout country choices with the single flat shipping amount and policy pages.
- **Expected:** Automated rates and policy claims must match the business's actual operating area.
- **Observed:** Checkout offered six countries using one US-oriented flat rate; copy asserted international duties and a 14-day reprint/refund remedy without a confirmed client policy.
- **Cause:** Options and legal copy were not backed by rate/tax/policy configuration.
- **Fix:** Automated checkout is now US-only. International customers are directed to request a quote. Unsupported deadline and guaranteed-remedy language was replaced with a prompt review process.
- **Verification:** Checkout rejects non-US payloads server-side; responsive checkout and cart tests pass. Client must still approve tax collection, exact return window/remedies, international markets, and rates.

### 5. Product imagery and color fidelity varied across surfaces — Confirmed / fixed in current catalog; supplier approval-dependent

- **Trigger:** Compare shop cards, product front/back/side images, color swatches, customizer garment, saved design, cart, and admin proof.
- **Expected:** One canonical blank family and color should remain consistent across the customer flow.
- **Observed:** Earlier catalog assets mixed silhouettes, on-model and isolated views, stale color substitutions, and misleading sample prints.
- **Cause:** Product assets were assembled from inconsistent sources and fallbacks.
- **Fix:** Catalog families, color rendering, front/back/side views, and handoff were normalized. Shop cards use blank product imagery; category merchandising remains clearly illustrative.
- **Verification:** `qa-product-gallery` passes all 20 products and 272 variations. `qa-garment-families` passes every configured color, both sides, route sync, and zero overflow. Final blank/brand imagery still needs client/supplier approval.

### 6. Upload, editor, background removal, and production output needed honest limits — Confirmed / fixed behavior; source-storage limitation documented

- **Trigger:** Upload PNG, JPG, WebP, HEIC, renamed HEIC, AVIF, SVG, a large phone photo, invalid data, or artwork with a difficult background; edit, group, move, resize, save, and switch products.
- **Expected:** Supported files work on desktop/mobile; invalid files fail clearly; gestures do not open panels accidentally; saved placement persists; output claims match actual resolution.
- **Observed:** Earlier interaction regressions reopened panels on drag and mobile sheets could shrink/cover the stage. Copy implied production-ready output even though browser raster uploads are optimized and previews are 640px.
- **Cause:** Pointer release and drag intent were conflated; mobile layout and production terminology were too optimistic.
- **Fix:** Tap-vs-drag intent, outside-panel dismissal, full-size mobile stage, grouping, upload sniffing/conversion, downscaling, removal fallbacks, and honest screen-proof copy are in place.
- **Verification:** Customizer controls/interactions/grouping, cutout/mask/actions, background removal, and upload-format suites pass. Original high-resolution raster storage is not implemented; production must request/retain the source outside this screen-proof payload.

### 7. Admin production workspace lacked complete proof and personalization context — Confirmed / fixed

- **Trigger:** Open an order in admin.
- **Expected:** Printer can inspect payment state, both sides, quantities, sizes, roster personalization, notes, saved artwork sources, shipping details, and status history.
- **Observed:** The workspace did not present all production data together and had no auditable state history.
- **Cause:** It was built as an order list rather than a production handoff.
- **Fix:** Added front/back proof grid, proof/source downloads, layer counts, roster table, notes, shipping/payment details, transition controls, audit history, and an explicit screen-proof quality warning.
- **Verification:** Protected/unconfigured admin checks pass. Configured admin sign-in is skipped because this checkout has no `QA_ADMIN_PASSWORD`.

### 8. Contact behavior was unclear and had no address — Confirmed / fixed fallback; configuration-dependent contact

- **Trigger:** Visit or submit `/contact` with blank site settings.
- **Expected:** A visitor knows whether the site sends a message and has a usable destination.
- **Observed:** The form opened an email client silently and no real address was configured.
- **Cause:** No email provider or business contact details were supplied.
- **Fix:** The form clearly states that it prepares a local email, validates inputs, and disables online enquiries until an address is published.
- **Verification:** Responsive audit shows labelled controls and no errors. The client must enter the real contact email/phone/address or select a server email provider.

### 9. Quantity-break copy disagreed with pricing code — Confirmed / fixed

- **Trigger:** Mix product configurations in one cart and compare terms, designer, cart, and checkout.
- **Expected:** Copy and server price calculation use the same quantity grouping.
- **Observed:** Terms said all garments in an order shared a break; `lib/pricing.ts` calculates each product configuration separately.
- **Cause:** Policy text was not updated with the pricing model.
- **Fix:** Customer copy now says breaks apply per product configuration; checkout continues to reprice exclusively from the database.
- **Verification:** Cart repricing and payment-tamper tests pass, including size surcharges and server-authoritative totals.

### 10. Unsupported marketing and policy claims — Confirmed / fixed copy; business facts remain client-dependent

- **Trigger:** Review home, FAQ, shipping, terms, privacy, about, and tracking against implemented behavior.
- **Expected:** No promise of exact print color/resolution, carrier tracking, automatic reorders/emails, a specific print method, or an unapproved remedy.
- **Observed:** Copy included exact-preview, 300 DPI/3600px, one-click reorder, DTG, tracking, 30+ colors, and local-ownership/return claims that code or supplied facts did not establish.
- **Cause:** Marketing content accumulated independently from production capability.
- **Fix:** Replaced those claims with placement-proof, available-color, order-progress, production-review, and policy-review language. Terms now use a real fixed revision date rather than changing on every render.
- **Verification:** Text search and rendered policy/home screenshots reviewed. Client legal/policy approval is still required.

### 11. Small controls and mobile panel overlap — Confirmed / fixed

- **Trigger:** Audit account, hero controls, and customizer at 320–1440px; drag artwork and dismiss sheets on phone.
- **Expected:** Controls meet at least 44px for key touch actions; canvas remains usable; keyboard labels/focus are present; no horizontal overflow.
- **Observed:** The earlier audit reported dozens of undersized controls and mobile panels could obstruct selection.
- **Cause:** Visual icon dimensions were also used as hit-box dimensions; bottom-sheet geometry did not reserve interaction space.
- **Fix:** Expanded account/hero/customizer hit targets, preserved compact visuals with pseudo-elements, kept the stage full-size, and separated editor dismissal from drag gestures.
- **Verification:** Full audit returns `{}` across desktop, laptop, tablet, 390px and 320px. Key routes also pass a 640 CSS-pixel desktop viewport equivalent to 200% zoom.

### 12. Duplicate Polo filter presentation — Confirmed / fixed

- **Trigger:** Open shop filters on mobile.
- **Expected:** One clear Polo Shirts option.
- **Observed:** Both a category and garment-kind filter rendered the same label.
- **Cause:** Filter groups were assembled independently.
- **Fix:** Suppressed the duplicate category chip when the exact polo kind is present.
- **Verification:** Mobile shop screenshot and search/filter/sort suite pass.

### 13. SEO, loading evidence, and image performance — Confirmed / fixed in code; deployed metrics configuration-dependent

- **Trigger:** Request metadata routes and capture full-page screenshots before lazy images finish.
- **Expected:** Public routes are discoverable, private routes are excluded, and visual evidence waits for visible images.
- **Observed:** No sitemap/robots files existed and the old audit could capture false blank-image evidence or wait forever on hidden carousel slides.
- **Cause:** Metadata and browser QA did not model private routes or lazy-image lifecycle.
- **Fix:** Added sitemap and robots rules, bounded image decode waits, scroll/decode evidence, hidden-slide exclusion, correct carousel responsive sizes, direct delivery of an already-compressed WebP, and explicit Next 16 loading hints for header/main product LCP images.
- **Verification:** Build emits `/sitemap.xml` and `/robots.txt`; full audit is clean. Production Core Web Vitals and CDN behavior still require deployed measurement.

### 14. QA scripts skipped or stalled meaningful checks — Confirmed / fixed

- **Trigger:** Run gallery, customizer interaction, grouping, or responsive audit scripts after newer imports/image behavior.
- **Expected:** Tests execute the intended assertions and fail only for product defects.
- **Observed:** Gallery selection had previously matched multiple stages; interaction/grouping loaders lacked newer module mocks; image decode could stall indefinitely.
- **Cause:** Test harnesses drifted behind application imports and rendering behavior.
- **Fix:** Kept singular gallery checks, added hosted-removal/HEIC/image-format mocks, bounded image waits, route/viewport filters, and incomplete-image evidence.
- **Verification:** Every constituent QA command now passes; the first aggregate run stopped at the stale grouping mock, which was repaired and rerun with all remaining commands passing.

### 15. Framework security advisories — Confirmed / fixed

- **Trigger:** Run `npm audit --omit=dev` on Next.js 16.3.8.
- **Expected:** No known production dependency advisory.
- **Observed:** The installed release was covered by critical Next.js Image Optimization and cached-data advisories plus an App Router denial-of-service advisory.
- **Cause:** The project was pinned below the patched minor release.
- **Fix:** Upgraded `next` and `eslint-config-next` together to 16.4.3 after reviewing the bundled version-16 guidance.
- **Verification:** Production dependency audit reports zero vulnerabilities; typecheck, lint, and production build pass on 16.4.3.

## Verification results

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; 22 static pages generated and all dynamic routes compiled |
| `npm audit --omit=dev` | Passed; 0 production advisories |
| Storefront responsive/search/filter/sort/wishlist/menu | Passed at 320, 390, 768, 820, 1024, and 1440px |
| Product galleries | Passed 20 products / 272 color variations |
| Full responsive/accessibility audit | Passed with empty findings across five primary widths and 20 routes |
| 200% zoom-equivalent audit | Passed key customer routes at 640 CSS px |
| Garment families | Passed all colors, both sides, sync, details, and overflow |
| Customizer controls/interactions/grouping | Passed desktop and phone |
| Upload formats/background removal | Passed normal, renamed, large, invalid, and mobile cases |
| Cart and checkout contract | Passed persistence, notes, repricing, disabled Stripe, and API refusal |
| Payment contract | Passed repricing, invalid sizes, ownership, signatures, payment, refund |
| Order privacy/recovery | Passed public status, verified guest, and owner paths |
| Checkout idempotency/status audit/replay | Passed |
| Customer account lifecycle | Passed register, empty state, sign-out, failed and valid login |
| Slow-network phone routes | Passed home, shop, customizer, account on throttled 3G |
| Admin | Protected/unconfigured behavior passed; configured sign-in skipped |

## Visual evidence

Fresh screenshots are written by `qa-audit` to `%TEMP%/qa`. Important reviewed files:

- `desktop-home.png`: complete homepage, product cards, imagery, process, policy-safe copy, footer.
- `mobile-home.png`: full mobile carousel, categories, products, promotional imagery, and bottom navigation.
- `mobile-shop.png`: filter simplification, complete two-column catalog, consistent swatches.
- `mobile-customizer.png`: full-height garment, compact header, rotate control, tool rail, no panel overlap.
- `desktop-product.png`: product gallery, colors, quantity and customization entry point.

## Launch readiness

Code-level P0/P1/P2 findings above are complete. Production launch still requires these external decisions or credentials:

1. Configure a strong production `ADMIN_PASSWORD` and run the configured admin sign-in check.
2. Configure Stripe test keys/webhook, complete the README test-mode checklist, then separately install live keys. Never use live cards for routine QA.
3. Enter the real business contact email, phone, and address. Choose an email provider only if automatic transactional email is required.
4. Approve US-only automated checkout or provide real international rates, duties/tax handling, and supported countries.
5. Approve the exact tax policy, return/claim window, remedies, cancellation policy, turnaround wording, and legal terms.
6. Approve each supplier blank, brand/style number, color name, canonical imagery, and print-area map. The VictoryTee page is a design reference, not a live supplier feed.
7. Decide how production receives original high-resolution raster artwork. Current order previews are screen placement proofs, not press-ready source files.
8. Optionally configure Google OAuth and its production callback; password accounts work without it, but password reset/email verification still need delivery infrastructure.
9. Set `NEXT_PUBLIC_SITE_URL` to the canonical production domain and confirm Vercel keeps `https://kingdom-custom-print.vercel.app` assigned to this project.
10. Run `npm run db:migrate` on the target database. Never run `db:reset` or `db:seed` on a database containing customer/catalog data.
11. Verify database backups, privacy retention/deletion operations, deployed webhook delivery, and production Core Web Vitals.

The site is code-ready for a configured staging acceptance pass, not yet truthfully production-ready until the items above are supplied and approved.
