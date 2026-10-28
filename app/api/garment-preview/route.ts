const families = new Set(["tee", "polo", "vneck", "longsleeve", "fitted", "pocket", "youth", "hoodie", "crew", "cap", "mug", "tote"]);
const bases: Record<string, string> = {
  "tee-front": "/img/mockups/garment/WHT_fr.webp",
  "tee-back": "/img/mockups/garment/WHT_bk.webp",
  "tee-side": "/img/catalog-models/tee-mask.png",
  "polo-front": "/img/products/polo-front.png",
  "polo-back": "/img/products/polo-back.png",
  "vneck-front": "/img/mockups/families/vneck/WHT_fr.webp",
  "vneck-back": "/img/mockups/families/vneck/WHT_bk.webp",
  "vneck-side": "/img/catalog-models/vneck-mask.png",
  "longsleeve-front": "/img/mockups/families/longsleeve/WHT_fr.webp",
  "longsleeve-back": "/img/mockups/families/longsleeve/WHT_bk.webp",
  "longsleeve-side": "/img/catalog-models/longsleeve-mask.png",
  "fitted-front": "/img/mockups/families/fitted/WHT_fr.webp",
  "fitted-back": "/img/mockups/families/fitted/WHT_bk.webp",
  "fitted-side": "/img/catalog-models/fitted-mask.png",
  "pocket-front": "/img/mockups/families/pocket/WHT_fr.webp",
  "pocket-back": "/img/mockups/families/pocket/WHT_bk.webp",
  "pocket-side": "/img/catalog-models/pocket-mask.png",
  "youth-front": "/img/mockups/families/youth/WHT_fr.webp",
  "youth-back": "/img/mockups/families/youth/WHT_bk.webp",
  "youth-side": "/img/catalog-models/youth-mask.png",
  "hoodie-front": "/img/mockups/families/hoodie/WHT_fr.webp",
  "hoodie-back": "/img/mockups/families/hoodie/WHT_bk.webp",
  "hoodie-side": "/img/catalog-models/hoodie-mask.png",
  "crew-front": "/img/mockups/families/crew/WHT_fr.webp",
  "crew-back": "/img/mockups/families/crew/WHT_bk.webp",
  "crew-side": "/img/catalog-models/crew-mask.png",
  "cap-front": "/img/mockups/families/cap/WHT_fr.webp",
  "cap-back": "/img/mockups/families/cap/WHT_bk.webp",
  "mug-front": "/img/mockups/families/mug/WHT_fr.webp",
  "mug-back": "/img/mockups/families/mug/WHT_bk.webp",
  "tote-front": "/img/mockups/families/tote/WHT_fr.webp",
  "tote-back": "/img/mockups/families/tote/WHT_bk.webp",
};

/** Exact catalog colors over an isolated white fabric base, including shadows. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const family = params.get("family") ?? "tee";
  const side = params.get("view") ?? "front";
  const color = params.get("color") ?? "FFFFFF";
  if (!families.has(family) || !["front", "back", "side"].includes(side) || (side === "side" && ["polo", "cap", "mug", "tote"].includes(family)) || !/^[a-f\d]{6}$/i.test(color)) {
    return new Response("Invalid garment preview", { status: 400 });
  }
  const key = `${family}-${side}`;
  const channels = color.match(/../g)!.map(c => parseInt(c, 16) / 255);
  const matrix = `${channels[0]} 0 0 0 0 0 ${channels[1]} 0 0 0 0 0 ${channels[2]} 0 0 0 0 0 1 0`;
  const viewBox = side === "side" ? "0 0 724 724" : "0 0 1024 1024";
  const imageBox = side === "side" ? 'x="-1448" width="2172" height="724"' : 'width="1024" height="1024"';
  const base = bases[key];
  if (!base) return new Response("Garment preview is unavailable", { status: 404 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="${viewBox}"><defs><filter id="fabric" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrix}"/></filter></defs><image ${imageBox} href="${base}" filter="url(#fabric)"/></svg>`;
  return new Response(svg, { headers: {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400, s-maxage=31536000",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
  } });
}
