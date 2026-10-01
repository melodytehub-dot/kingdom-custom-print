# Kingdom Custom Print

Custom print-on-demand storefront for apparel, drinkware and headwear. Customers
pick a blank, design it in the browser (text and artwork, front and back), set a
size run, and check out. Everything is priced from a quantity-break table and
re-priced on the server at checkout.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- PostgreSQL via Neon (`postgres` driver), schema in [`db/schema.sql`](db/schema.sql)
- Stripe Checkout with a signature-verified webhook
- Plain CSS design system (no UI framework)

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:migrate           # create the schema
npm run db:seed              # load the starter catalogue
npm run dev
```

The site runs at http://localhost:3000 and the admin at `/admin`.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `ADMIN_PASSWORD` | for `/admin` | Admin sign-in, 12 characters or more |
| `STRIPE_SECRET_KEY` | for card payments | Server-side Stripe API key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | for card payments | Stripe.js key |
| `STRIPE_WEBHOOK_SECRET` | for card payments | Verifies `/api/webhook` events |
| `NEXT_PUBLIC_SITE_URL` | recommended | Absolute base URL for Stripe redirects |

Without the Stripe keys, checkout still records the order and shows the
reference so payment can be arranged manually. Nothing is charged.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm run db:migrate` | Apply `db/schema.sql` (idempotent) |
| `npm run db:seed` | Load categories, products and site settings |
| `npm run db:reset` | Drop, re-migrate and re-seed |

### QA scripts

These drive a real Chrome instance against a running dev server.

```bash
node scripts/qa-audit.mjs        # responsive, overflow, a11y and console audit
node scripts/qa-cart-flow.mjs    # design -> cart -> reprice -> checkout
QA_ADMIN_PASSWORD=... node scripts/qa-admin-flow.mjs   # admin sign-in
```

`qa-audit.mjs` writes screenshots to `/tmp/qa` for each route and viewport.

## Pricing

`lib/pricing.ts` is the single source of truth:

```
unitBase = blank price + (sides used x print fee) + quantity-break discount
total    = unitBase x garment count + size surcharges
```

Shipping is flat, waived above the configured threshold. The checkout API
recomputes every amount from the database and ignores prices sent by the client,
so a tampered cart cannot change what is charged.

## Administration

`/admin` uses a single shared password and a signed, httpOnly session cookie
valid for 12 hours, with repeated failed attempts throttled. From there you can
review and update orders, manage products and variants, edit site settings
(shipping rates, production time, contact details) and browse customers.

## Deployment

The project is linked to Vercel and reads `DATABASE_URL` from the Neon
integration. Set `ADMIN_PASSWORD` and the Stripe variables in the Vercel project
settings, then run `npm run db:migrate` and `npm run db:seed` against the
production database before the first live order.

Point a Stripe webhook at `https://<your-domain>/api/webhook` and subscribe it
to `checkout.session.completed` and `checkout.session.expired`.

## Before going live

- Replace the placeholder logo with the client's final artwork.
- Fill in the real contact email, phone and address in admin settings; the
  contact and footer pages render them once set.
- Confirm the logo on `public/brand/kingdom-logo.svg` matches the supplied file.