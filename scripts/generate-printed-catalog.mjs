import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import sharp from "sharp";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const root = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(root, "public", "img", "printed-catalog");
const size = 768;
// Centers follow each garment's printable surface, which is not always centered in its image.
const positions = {
  tee: { x: 384, y: 232, width: 120 },
  vneck: { x: 389, y: 246, width: 112 },
  fitted: { x: 409, y: 242, width: 106 },
  youth: { x: 401, y: 242, width: 105 },
  pocket: { x: 395, y: 252, width: 112 },
  longsleeve: { x: 418, y: 240, width: 116 },
  hoodie: { x: 431, y: 256, width: 120 },
  crew: { x: 408, y: 234, width: 120 },
  polo: { x: 384, y: 252, width: 108 },
  cap: { x: 404, y: 274, width: 112 },
  tote: { x: 458, y: 474, width: 130 },
  mug: { x: 343, y: 338, width: 126 },
};

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

async function crownFor(family) {
  const { width } = positions[family];
  const { data, info } = await sharp(path.join(root, "public/img/sample-crown.png"))
    .resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function printVariant(base, crown, family, hex) {
  const rgb = hex.replace("#", "").match(/../g).map((part) => Number.parseInt(part, 16));
  const dark = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 < 145;
  const ink = dark ? [248, 239, 213] : [23, 24, 22];
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

  const placement = positions[family];
  const left = Math.round(placement.x - crown.width / 2);
  for (let y = 0; y < crown.height; y++) {
    for (let x = 0; x < crown.width; x++) {
      const src = (y * crown.width + x) * 4;
      const dst = ((placement.y + y) * size + left + x) * 4;
      const coverage = crown.data[src + 3] / 255 * .94;
      if (coverage === 0 || result[dst + 3] === 0) continue;
      const fabricLight = (base[dst] + base[dst + 1] + base[dst + 2]) / (3 * 232);
      for (let channel = 0; channel < 3; channel++) {
        const printed = ink[channel] * Math.min(1.08, fabricLight);
        result[dst + channel] = Math.round(result[dst + channel] * (1 - coverage) + printed * coverage);
      }
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
  const crowns = new Map();
  const manifest = {};
  let count = 0;
  for (const row of rows) {
    if (!/^[a-z0-9-]+$/.test(row.product_slug) || !/^[a-z0-9-]+$/.test(row.color_slug) || !/^#[0-9a-f]{6}$/i.test(row.hex)) {
      throw new Error(`Invalid catalog variant: ${row.product_slug}/${row.color_slug}`);
    }
    const family = familyFor({ slug: row.product_slug, kind: row.kind });
    if (!positions[family]) throw new Error(`Missing image source for ${family}`);
    if (!families.has(family)) families.set(family, await baseFor(family));
    if (!crowns.has(family)) crowns.set(family, await crownFor(family));
    const directory = path.join(outputRoot, row.product_slug);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${row.color_slug}.webp`);
    if (row.product_slug === "classic-pique-polo" && row.color_slug === "black") {
      await sharp(path.join(root, "public/img/products/polo-black-crown.webp"))
        .resize(size, size).webp({ quality: 84, effort: 4 }).toFile(file);
    } else {
      const result = printVariant(families.get(family), crowns.get(family), family, row.hex);
      await sharp(result, { raw: { width: size, height: size, channels: 4 } })
        .webp({ quality: 84, effort: 4 }).toFile(file);
    }
    (manifest[row.product_slug] ??= []).push(row.color_slug);
    count++;
  }
  await writeFile(path.join(root, "lib", "printed-catalog-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Generated ${count} finished previews for ${Object.keys(manifest).length} products.`);
} finally {
  await sql.end();
}
