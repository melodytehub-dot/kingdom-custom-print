import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
const families = new Set(["tee", "vneck", "longsleeve", "fitted", "pocket", "youth", "hoodie", "crew", "cap", "mug", "tote"]);
const bases = new Map<string, Promise<string>>();

// Literal asset paths keep serverless bundles limited to the required bases.
const readers: Record<string, () => Promise<Buffer>> = {
  "tee-front": () => readFile(path.join(process.cwd(), "public/img/mockups/garment/WHT_fr.webp")),
  "tee-back": () => readFile(path.join(process.cwd(), "public/img/mockups/garment/WHT_bk.webp")),
  "tee-side": () => readFile(path.join(process.cwd(), "public/img/catalog-models/tee-mask.png")),
  "vneck-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/vneck/WHT_fr.webp")),
  "vneck-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/vneck/WHT_bk.webp")),
  "vneck-side": () => readFile(path.join(process.cwd(), "public/img/catalog-models/vneck-mask.png")),
  "longsleeve-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/longsleeve/WHT_fr.webp")),
  "longsleeve-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/longsleeve/WHT_bk.webp")),
  "longsleeve-side": () => readFile(path.join(process.cwd(), "public/img/catalog-models/longsleeve-mask.png")),
  "fitted-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/fitted/WHT_fr.webp")),
  "fitted-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/fitted/WHT_bk.webp")),
  "fitted-side": () => readFile(path.join(process.cwd(), "public/img/catalog-models/fitted-mask.png")),
  "pocket-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/pocket/WHT_fr.webp")),
  "pocket-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/pocket/WHT_bk.webp")),
  "pocket-side": () => readFile(path.join(process.cwd(), "public/img/catalog-models/pocket-mask.png")),
  "youth-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/youth/WHT_fr.webp")),
  "youth-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/youth/WHT_bk.webp")),
  "youth-side": () => readFile(path.join(process.cwd(), "public/img/catalog-models/youth-mask.png")),
  "hoodie-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/hoodie/WHT_fr.webp")),
  "hoodie-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/hoodie/WHT_bk.webp")),
  "hoodie-side": () => readFile(path.join(process.cwd(), "public/img/catalog-models/hoodie-mask.png")),
  "crew-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/crew/WHT_fr.webp")),
  "crew-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/crew/WHT_bk.webp")),
  "crew-side": () => readFile(path.join(process.cwd(), "public/img/catalog-models/crew-mask.png")),
  "cap-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/cap/WHT_fr.webp")),
  "cap-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/cap/WHT_bk.webp")),
  "mug-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/mug/WHT_fr.webp")),
  "mug-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/mug/WHT_bk.webp")),
  "tote-front": () => readFile(path.join(process.cwd(), "public/img/mockups/families/tote/WHT_fr.webp")),
  "tote-back": () => readFile(path.join(process.cwd(), "public/img/mockups/families/tote/WHT_bk.webp")),
};

/** Exact catalog colors over an isolated white fabric base, including shadows. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const family = params.get("family") ?? "tee";
  const side = params.get("view") ?? "front";
  const color = params.get("color") ?? "FFFFFF";
  if (!families.has(family) || !["front", "back", "side"].includes(side) || (side === "side" && ["cap", "mug", "tote"].includes(family)) || !/^[a-f\d]{6}$/i.test(color)) {
    return new Response("Invalid garment preview", { status: 400 });
  }
  const key = `${family}-${side}`;
  let base = bases.get(key);
  if (!base) {
    base = readers[key]().then(bytes => bytes.toString("base64"));
    bases.set(key, base);
    base.catch(() => bases.delete(key));
  }
  const channels = color.match(/../g)!.map(c => parseInt(c, 16) / 255);
  const matrix = `${channels[0]} 0 0 0 0 0 ${channels[1]} 0 0 0 0 0 ${channels[2]} 0 0 0 0 0 1 0`;
  const viewBox = side === "side" ? "0 0 724 724" : "0 0 1024 1024";
  const imageBox = side === "side" ? 'x="-1448" width="2172" height="724"' : 'width="1024" height="1024"';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${viewBox}"><defs><filter id="fabric" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrix}"/></filter></defs><image ${imageBox} href="data:image/${side === "side" ? "png" : "webp"};base64,${await base}" filter="url(#fabric)"/></svg>`;
  return new Response(svg, { headers: {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400, s-maxage=31536000",
    "Content-Security-Policy": "default-src 'none'; img-src data:; sandbox",
  } });
}
