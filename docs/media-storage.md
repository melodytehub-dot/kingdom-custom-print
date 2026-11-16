# Image storage

Product photos and hosted-cutout bridge photos are stored in the Cloudflare R2
bucket `kingdom-custom-print-media`, bound to the Worker as `MEDIA`. R2 has no
2 MB row limit, so uploads are capped at a practical 15 MB for product photos
and 10 MB for the cutout bridge.

## How it is wired

- `cloudflare.config.ts` declares `MEDIA: bindings.r2({ name: "..." })`.
- `wrangler.toml` declares the same binding for direct CLI deploys.
- `worker.ts` exposes the bucket on `globalThis.__kcpMediaBucket` for app code
  and sweeps expired cutout images from the hourly schedule.
- `lib/media-storage.ts` is the only module that talks to R2. Keys are
  `product/<uuid>` and `cutout/<id>`.

Local development has no R2 binding, so `putMedia`/`readMedia` fall back to the
`catalog_media` and `cutout_bridge_images` SQLite tables. Reads also check those
tables after R2, so an image uploaded before the R2 move still resolves.

## Operations

Create the bucket once per account:

```powershell
npx cf r2 buckets create --name kingdom-custom-print-media
```

Deploy normally:

```powershell
npm run build:cloudflare
npx cf deploy --prebuilt
```

Cutout bridge objects are deleted after 24 hours by the hourly Worker schedule.
Product photos are kept until the product or gallery entry is removed; deleting
a product does not currently delete its R2 object.

## Limits

- Product media: 15 MB (`app/api/admin/product-media/route.ts`).
- Cutout bridge: 10 MB (`app/api/cutout-bridge/route.ts` and
  `lib/hostedCutout.ts`).
- Accepted formats: JPEG, PNG, WebP, detected from the file header.
