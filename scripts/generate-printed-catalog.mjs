import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import sharp from "sharp";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const root = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(root, "public", "img", "printed-catalog");
const size = 768;
const supportedFamilies = new Set(["tee", "vneck", "fitted", "youth", "pocket", "longsleeve", "hoodie", "crew", "polo", "cap", "tote", "mug"]);

function familyFor(product) {
  return ({
    "v-neck-tee": "vneck",
    "womens-fitted-tee": "fitted",
    "youth-classic-tee": "youth",
    "pocket-tee": "pocket",
    "long-sleeve-tee": "longsleeve",
  })[product.slug] ?? product.kind;
}

async function baseFor(family) {
  const file = family === "tee"
    ? "public/img/mockups/garment/WHT_fr.webp"
    : family === "polo"
      ? "public/img/products/polo-front.png"
      : `public/img/mockups/families/${family}/WHT_fr.webp`;
  const { data } = await sharp(path.join(root, file)).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}

function colorVariant(base, hex) {
  const rgb = hex.replace("#", "").match(/../g).map((part) => Number.parseInt(part, 16));
  const result = Buffer.from(base);

  for (let pixel = 0; pixel < result.length; pixel += 4) {
    if (base[pixel + 3] < 8) {
      result[pixel + 3] = 0;
      continue;
    }
    const light = (base[pixel] + base[pixel + 1] + base[pixel + 2]) / 3;
    const shade = Math.min(1.08, light / 232);
    for (let channel = 0; channel < 3; channel++) {
      const texture = (light - 210) * .1 * (1 - rgb[channel] / 255);
      result[pixel + channel] = Math.max(0, Math.min(255, Math.round(rgb[channel] * shade + texture)));
    }
  }

  return result;
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
try {
  const rows = await sql`
    SELECT p.slug AS product_slug, p.kind, c.slug AS color_slug, c.hex
    FROM products p JOIN product_colors c ON c.product_id = p.id
    WHERE p.active ORDER BY p.sort_order, p.id, c.sort_order, c.id
  `;
  const families = new Map();
  const manifest = {};
  let count = 0;
  for (const row of rows) {
    if (!/^[a-z0-9-]+$/.test(row.product_slug) || !/^[a-z0-9-]+$/.test(row.color_slug) || !/^#[0-9a-f]{6}$/i.test(row.hex)) {
      throw new Error(`Invalid catalog variant: ${row.product_slug}/${row.color_slug}`);
    }
    const family = familyFor({ slug: row.product_slug, kind: row.kind });
    if (!supportedFamilies.has(family)) throw new Error(`Missing image source for ${family}`);
    if (!families.has(family)) families.set(family, await baseFor(family));
    const directory = path.join(outputRoot, row.product_slug);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${row.color_slug}.webp`);
    const result = colorVariant(families.get(family), row.hex);
    await sharp(result, { raw: { width: size, height: size, channels: 4 } })
      .webp({ quality: 84, effort: 4 }).toFile(file);
    (manifest[row.product_slug] ??= []).push(row.color_slug);
    count++;
  }
  await writeFile(path.join(root, "lib", "printed-catalog-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${count} blank previews for ${Object.keys(manifest).length} products.`);
} finally {
  await sql.end();
}
