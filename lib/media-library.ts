import "server-only";
import { sql } from "./db";
import { parseSettingValue } from "./catalog";
import { mediaBucket, referencedProductMedia } from "./media-storage";

export const MEDIA_LIBRARY_META_KEY = "media_library_meta_v1";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MediaMetaEntry = {
  name: string;
  alt: string;
  uploadedAt: string;
};

export type MediaLibraryItem = {
  id: string;
  url: string;
  name: string;
  alt: string;
  uploadedAt: string;
  source: "upload" | "store";
  inUse: boolean;
};

export const STORE_STOCK_PHOTOS: Omit<MediaLibraryItem, "inUse">[] = [
  { id: "store-shop-studio", url: "/img/shop-studio.png", name: "Print Studio", alt: "Kingdom Custom Print studio with printed shirt", uploadedAt: "", source: "store" },
  { id: "store-shop-printing", url: "/img/shop-printing.png", name: "Custom Printing", alt: "Custom graphic being printed on a shirt", uploadedAt: "", source: "store" },
  { id: "store-kingdom-team", url: "/img/kingdom-team.webp", name: "Team Apparel", alt: "People wearing matching Kingdom Custom Print shirts", uploadedAt: "", source: "store" },
  { id: "store-loyalty-group", url: "/img/loyalty-group.webp", name: "Group Apparel", alt: "Group wearing custom printed apparel", uploadedAt: "", source: "store" },
  { id: "store-col-shirts", url: "/img/collections/shirts.jpg", name: "Collection — Shirts", alt: "Custom printed t-shirts", uploadedAt: "", source: "store" },
  { id: "store-col-totes", url: "/img/collections/totes.jpg", name: "Collection — Totes", alt: "Custom printed tote bags", uploadedAt: "", source: "store" },
  { id: "store-col-caps", url: "/img/collections/caps.jpg", name: "Collection — Caps", alt: "Custom printed caps", uploadedAt: "", source: "store" },
  { id: "store-col-merch", url: "/img/collections/merch.jpg", name: "Collection — Merch", alt: "Custom printed mugs and merchandise", uploadedAt: "", source: "store" },
  { id: "store-cat-shirts", url: "/img/category-prints/shirts.webp", name: "Category — Shirts", alt: "Shirts category preview", uploadedAt: "", source: "store" },
  { id: "store-cat-polos", url: "/img/category-prints/polos.webp", name: "Category — Polos", alt: "Polos category preview", uploadedAt: "", source: "store" },
  { id: "store-cat-long-sleeves", url: "/img/category-prints/long-sleeves.webp", name: "Category — Long Sleeves", alt: "Long sleeves category preview", uploadedAt: "", source: "store" },
  { id: "store-cat-hoodies", url: "/img/category-prints/hoodies.webp", name: "Category — Hoodies", alt: "Hoodies category preview", uploadedAt: "", source: "store" },
  { id: "store-cat-caps", url: "/img/category-prints/caps.webp", name: "Category — Caps", alt: "Caps category preview", uploadedAt: "", source: "store" },
  { id: "store-cat-totes", url: "/img/category-prints/totes.webp", name: "Category — Totes", alt: "Totes category preview", uploadedAt: "", source: "store" },
  { id: "store-cat-merch", url: "/img/category-prints/merch.webp", name: "Category — Merch", alt: "Merch category preview", uploadedAt: "", source: "store" },
  { id: "store-cat-active", url: "/img/category-prints/active-wear.webp", name: "Category — Active Wear", alt: "Active wear category preview", uploadedAt: "", source: "store" },
];

type MetaMap = Record<string, MediaMetaEntry>;

async function readMetaMap(): Promise<MetaMap> {
  const [row] = await sql<{ value: unknown }[]>`
    SELECT value FROM site_settings WHERE key = ${MEDIA_LIBRARY_META_KEY} LIMIT 1`;
  if (!row) return {};
  const parsed = parseSettingValue(row.value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const map: MetaMap = {};
  for (const [id, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (!UUID.test(id) || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const rec = entry as Record<string, unknown>;
    map[id.toLowerCase()] = {
      name: typeof rec.name === "string" ? rec.name.slice(0, 120) : "Uploaded photo",
      alt: typeof rec.alt === "string" ? rec.alt.slice(0, 160) : "",
      uploadedAt: typeof rec.uploadedAt === "string" ? rec.uploadedAt : "",
    };
  }
  return map;
}

async function writeMetaMap(map: MetaMap): Promise<void> {
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (${MEDIA_LIBRARY_META_KEY}, ${sql.json(map)}, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    ON CONFLICT (key) DO UPDATE
      SET value = excluded.value, updated_at = excluded.updated_at`;
}

export async function recordUploadedMediaMeta(
  id: string,
  name: string,
  alt = ""
): Promise<void> {
  if (!UUID.test(id)) return;
  const cleanId = id.toLowerCase();
  const map = await readMetaMap();
  map[cleanId] = {
    name: (name || "Uploaded photo").trim().slice(0, 120) || "Uploaded photo",
    alt: alt.trim().slice(0, 160),
    uploadedAt: new Date().toISOString(),
  };
  await writeMetaMap(map);
}

export async function updateMediaMeta(
  id: string,
  patch: { name?: string; alt?: string }
): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const cleanId = id.toLowerCase();
  const map = await readMetaMap();
  const current = map[cleanId] ?? {
    name: "Uploaded photo",
    alt: "",
    uploadedAt: new Date().toISOString(),
  };
  map[cleanId] = {
    name: patch.name !== undefined ? patch.name.trim().slice(0, 120) || current.name : current.name,
    alt: patch.alt !== undefined ? patch.alt.trim().slice(0, 160) : current.alt,
    uploadedAt: current.uploadedAt,
  };
  await writeMetaMap(map);
  return true;
}

export async function listMediaLibrary(): Promise<{
  uploads: MediaLibraryItem[];
  store: MediaLibraryItem[];
}> {
  const [meta, referenced, sqliteRows] = await Promise.all([
    readMetaMap(),
    referencedProductMedia(),
    sql<{ id: string; created_at: string }[]>`
      SELECT id, created_at FROM catalog_media ORDER BY created_at DESC LIMIT 200`,
  ]);

  const byId = new Map<string, { uploadedAt: string }>();

  for (const row of sqliteRows) {
    if (UUID.test(row.id)) {
      byId.set(row.id.toLowerCase(), { uploadedAt: row.created_at });
    }
  }

  const bucket = mediaBucket();
  if (bucket) {
    let cursor: string | undefined;
    let pages = 0;
    do {
      const listed = await bucket.list({ prefix: "product/", cursor });
      for (const object of listed.objects) {
        const id = object.key.slice("product/".length).toLowerCase();
        if (!UUID.test(id)) continue;
        byId.set(id, {
          uploadedAt: object.uploaded ? object.uploaded.toISOString() : byId.get(id)?.uploadedAt ?? "",
        });
      }
      cursor = listed.truncated ? listed.cursor : undefined;
      pages += 1;
    } while (cursor && pages < 5);
  }

  const uploads: MediaLibraryItem[] = Array.from(byId.entries())
    .map(([id, info]) => {
      const m = meta[id];
      return {
        id,
        url: `/api/product-media/${id}`,
        name: m?.name || `Photo ${id.slice(0, 8)}`,
        alt: m?.alt || "",
        uploadedAt: m?.uploadedAt || info.uploadedAt || "",
        source: "upload" as const,
        inUse: referenced.has(id),
      };
    })
    .sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));

  const store: MediaLibraryItem[] = STORE_STOCK_PHOTOS.map((entry) => ({
    ...entry,
    inUse: true,
  }));

  return { uploads, store };
}

export async function deleteUploadedMedia(
  id: string
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "in-use" }> {
  if (!UUID.test(id)) return { ok: false, reason: "invalid" };
  const cleanId = id.toLowerCase();
  const referenced = await referencedProductMedia();
  if (referenced.has(cleanId)) {
    return { ok: false, reason: "in-use" };
  }

  const bucket = mediaBucket();
  if (bucket) {
    await bucket.delete(`product/${cleanId}`).catch(() => {});
  }
  await sql`DELETE FROM catalog_media WHERE id = ${cleanId}`;

  const map = await readMetaMap();
  if (cleanId in map) {
    delete map[cleanId];
    await writeMetaMap(map);
  }

  return { ok: true };
}
