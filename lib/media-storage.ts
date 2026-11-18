import { sql } from "./db";

/**
 * Image storage for product photos and the hosted-cutout bridge.
 *
 * Production uses the R2 bucket bound as `MEDIA`. Local development has no
 * bucket, so the original SQLite tables keep working; reads also fall back to
 * those tables so any image uploaded before the R2 move still resolves.
 */

export type MediaArea = "product" | "cutout";

export type MediaBucket = {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<unknown>;
  get(key: string): Promise<{
    httpMetadata?: { contentType?: string };
    arrayBuffer(): Promise<ArrayBuffer>;
  } | null>;
  head(key: string): Promise<unknown | null>;
  delete(key: string): Promise<unknown>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    objects: { key: string; uploaded?: Date }[];
    truncated: boolean;
    cursor?: string;
  }>;
};

declare global {
  var __kcpMediaBucket: MediaBucket | undefined;
}

/** The R2 bucket, or null in local development. */
export function mediaBucket(): MediaBucket | null {
  return globalThis.__kcpMediaBucket ?? null;
}

export function usingMediaBucket(): boolean {
  return mediaBucket() !== null;
}

function keyFor(area: MediaArea, id: string): string {
  return `${area}/${id}`;
}

/** Stores an image. R2 when available, otherwise the local SQLite table. */
export async function putMedia(
  area: MediaArea,
  id: string,
  bytes: Uint8Array,
  contentType: string
): Promise<void> {
  const bucket = mediaBucket();
  if (bucket) {
    await bucket.put(keyFor(area, id), bytes, { httpMetadata: { contentType } });
    return;
  }
  if (area === "product") {
    await sql`INSERT INTO catalog_media (id, content_type, content) VALUES (${id}, ${contentType}, ${bytes})`;
  } else {
    await sql`INSERT INTO cutout_bridge_images (id, content_type, bytes) VALUES (${id}, ${contentType}, ${bytes})`;
  }
}

export type StoredMedia = { bytes: Uint8Array; contentType: string };

/** Reads an image, including rows written before the R2 move. */
export async function readMedia(area: MediaArea, id: string): Promise<StoredMedia | null> {
  const bucket = mediaBucket();
  if (bucket) {
    const object = await bucket.get(keyFor(area, id));
    if (object) {
      return {
        bytes: new Uint8Array(await object.arrayBuffer()),
        contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
      };
    }
  }
  if (area === "product") {
    const [row] = await sql<{ content_type: string; content: Uint8Array }[]>`
      SELECT content_type, content FROM catalog_media WHERE id = ${id}`;
    return row ? { bytes: row.content, contentType: row.content_type } : null;
  }
  const [row] = await sql<{ content_type: string; bytes: Uint8Array }[]>`
    SELECT content_type, bytes FROM cutout_bridge_images
    WHERE id = ${id} AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')`;
  return row ? { bytes: row.bytes, contentType: row.content_type } : null;
}

export async function mediaExists(area: MediaArea, id: string): Promise<boolean> {
  const bucket = mediaBucket();
  if (bucket) {
    if (await bucket.head(keyFor(area, id))) return true;
  }
  if (area === "product") {
    const [row] = await sql`SELECT 1 FROM catalog_media WHERE id = ${id} LIMIT 1`;
    return Boolean(row);
  }
  const [row] = await sql`
    SELECT 1 FROM cutout_bridge_images
    WHERE id = ${id} AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')
    LIMIT 1`;
  return Boolean(row);
}

/**
 * Removes cutout bridge images older than a day. Runs from the Worker's hourly
 * schedule and after an upload; R2 objects and legacy SQLite rows are both
 * covered.
 */
export async function sweepExpiredCutout(): Promise<void> {
  await sql`DELETE FROM cutout_bridge_images WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')`;
  const bucket = mediaBucket();
  if (!bucket) return;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix: "cutout/", cursor });
    for (const object of listed.objects) {
      if (object.uploaded && object.uploaded.getTime() < cutoff) {
        await bucket.delete(object.key);
      }
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

const PRODUCT_PREFIX = "product/";

/** Unused product photos young enough that an editor may still put them back. */
const ORPHAN_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Upper bound on deletions per run. A backlog this large means the reference
 * scan is probably wrong, so the sweep stops instead of clearing the bucket.
 */
const MAX_ORPHANS_PER_RUN = 25;

const MEDIA_URL_ID = /\/api\/product-media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

/**
 * Every product photo the database still points at.
 *
 * Uploads are only stored in three places: a colour's front/back image, the
 * ready-made gallery rows, and the JSON values in `site_settings` (the homepage
 * layout and custom pages live there). Add any new image column here as well.
 */
export async function referencedProductMedia(): Promise<Set<string>> {
  const ids = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value !== "string") return;
    for (const match of value.matchAll(MEDIA_URL_ID)) ids.add(match[1].toLowerCase());
  };

  const colors = await sql<{ front_image: string | null; back_image: string | null }[]>`
    SELECT front_image, back_image FROM product_colors`;
  for (const row of colors) {
    collect(row.front_image);
    collect(row.back_image);
  }

  const images = await sql<{ url: string | null }[]>`SELECT url FROM product_images`;
  for (const row of images) collect(row.url);

  const settings = await sql<{ value: string }[]>`SELECT value FROM site_settings`;
  for (const row of settings) collect(row.value);

  return ids;
}

export type ProductMediaSweep = {
  /** Objects examined under `product/`. */
  scanned: number;
  /** Photo ids the database still references. */
  referenced: number;
  /** Keys removed from the bucket. */
  deleted: string[];
  /** Unreferenced keys left for a later run. */
  kept: string[];
};

/**
 * Removes product photos nothing points at any more.
 *
 * A photo is only deleted when it is unreferenced, older than the grace period
 * and has a known upload time; anything unexpected is kept. Runs daily from the
 * Worker's schedule, so a mistaken reference scan costs at most the cap below
 * and not the whole bucket.
 */
export async function sweepOrphanProductMedia(now = Date.now()): Promise<ProductMediaSweep> {
  const report: ProductMediaSweep = { scanned: 0, referenced: 0, deleted: [], kept: [] };
  const bucket = mediaBucket();
  if (!bucket) return report;

  const objects: { key: string; uploaded?: Date }[] = [];
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix: PRODUCT_PREFIX, cursor });
    objects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const referenced = await referencedProductMedia();
  report.scanned = objects.length;
  report.referenced = referenced.size;

  const orphans = objects.filter((object) => {
    const id = object.key.slice(PRODUCT_PREFIX.length).toLowerCase();
    if (!id || referenced.has(id)) return false;
    if (!object.uploaded) return false;
    return now - object.uploaded.getTime() > ORPHAN_GRACE_MS;
  });

  if (orphans.length > MAX_ORPHANS_PER_RUN) {
    report.kept = orphans.map((object) => object.key);
    return report;
  }

  for (const object of orphans) {
    await bucket.delete(object.key);
    report.deleted.push(object.key);
  }
  return report;
}
