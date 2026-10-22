import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const runtime = "nodejs";

type Source = { photo: () => Promise<Buffer>; mask?: () => Promise<Buffer> };
const sources: Record<string, Source> = {
  tee: { photo: () => readFile(path.join(process.cwd(), "public/img/catalog-models/tee.png")), mask: () => readFile(path.join(process.cwd(), "public/img/catalog-models/tee-mask.png")) },
  vneck: { photo: () => readFile(path.join(process.cwd(), "public/img/catalog-models/vneck.png")), mask: () => readFile(path.join(process.cwd(), "public/img/catalog-models/vneck-mask.png")) },
  longsleeve: { photo: () => readFile(path.join(process.cwd(), "public/img/catalog-models/longsleeve.png")), mask: () => readFile(path.join(process.cwd(), "public/img/catalog-models/longsleeve-mask.png")) },
  fitted: { photo: () => readFile(path.join(process.cwd(), "public/img/catalog-models/fitted.png")), mask: () => readFile(path.join(process.cwd(), "public/img/catalog-models/fitted-mask.png")) },
  pocket: { photo: () => readFile(path.join(process.cwd(), "public/img/catalog-models/pocket.png")), mask: () => readFile(path.join(process.cwd(), "public/img/catalog-models/pocket-mask.png")) },
  youth: { photo: () => readFile(path.join(process.cwd(), "public/img/catalog-models/youth.png")), mask: () => readFile(path.join(process.cwd(), "public/img/catalog-models/youth-mask.png")) },
  hoodie: { photo: () => readFile(path.join(process.cwd(), "public/img/catalog-models/hoodie.png")), mask: () => readFile(path.join(process.cwd(), "public/img/catalog-models/hoodie-mask.png")) },
  crew: { photo: () => readFile(path.join(process.cwd(), "public/img/catalog-models/crew.png")), mask: () => readFile(path.join(process.cwd(), "public/img/catalog-models/crew-mask.png")) },
  polo: { photo: () => readFile(path.join(process.cwd(), "public/img/products/polo-front.png")) },
};

type Base = { pixels: Buffer; mask: Buffer | null; width: number; height: number };
const bases = new Map<string, Promise<Base>>();
const crowns = new Map<number, Promise<{ pixels: Buffer; width: number; height: number }>>();

function trimMaskHalo(photo: Buffer, mask: Buffer, width: number, height: number) {
  for (let y = 0; y < height; y++) {
    let right = -1;
    for (let x = width - 1; x >= 0; x--) {
      if (mask[(y * width + x) * 4 + 3] > 20) {
        right = x;
        break;
      }
    }
    if (right < 0) continue;
    for (let x = Math.max(0, right - 35); x <= right; x++) {
      const pixel = (y * width + x) * 4;
      const red = photo[pixel], green = photo[pixel + 1], blue = photo[pixel + 2];
      const luminance = (red + green + blue) / 3;
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      const confidence = chroma > 35 ? 0 : Math.max(0, Math.min(1, (luminance - 192) / 18));
      mask[pixel + 3] = Math.round(mask[pixel + 3] * confidence);
    }
  }
}

function loadBase(family: string): Promise<Base> {
  const cached = bases.get(family);
  if (cached) return cached;
  const source = sources[family];
  const pending = Promise.all([source.photo(), source.mask?.()]).then(async ([photo, mask]) => {
    const polo = family === "polo";
    const width = polo ? 1254 : 724;
    const height = polo ? 1254 : 724;
    const crop = { left: 0, top: 0, width, height };
    const rawPhoto = await sharp(photo).extract(crop).ensureAlpha().raw().toBuffer();
    const rawMask = mask ? await sharp(mask).extract(crop).ensureAlpha().raw().toBuffer() : null;
    if (rawMask) trimMaskHalo(rawPhoto, rawMask, width, height);
    return { pixels: rawPhoto, mask: rawMask, width, height };
  });
  bases.set(family, pending);
  pending.catch(() => bases.delete(family));
  return pending;
}

function loadCrown(width: number) {
  const cached = crowns.get(width);
  if (cached) return cached;
  const pending = readFile(path.join(process.cwd(), "public/img/sample-crown.png"))
    .then(async (file) => {
      const { data, info } = await sharp(file).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { pixels: data, width: info.width, height: info.height };
    });
  crowns.set(width, pending);
  pending.catch(() => crowns.delete(width));
  return pending;
}

async function render(family: string, hex: string): Promise<Buffer> {
  const { pixels, mask, width, height } = await loadBase(family);
  const output = Buffer.from(pixels);
  const color = hex.match(/../g)!.map((part) => Number.parseInt(part, 16));
  const dark = (color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114) < 145;

  for (let i = 0; i < output.length; i += 4) {
    const coverage = mask ? mask[i + 3] / 255 : pixels[i + 3] / 255;
    if (coverage === 0) continue;
    const shade = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / (3 * 235);
    for (let channel = 0; channel < 3; channel++) {
      const dyed = Math.min(255, color[channel] * shade);
      output[i + channel] = Math.round(pixels[i + channel] * (1 - coverage) + dyed * coverage);
    }
  }

  const crown = await loadCrown(family === "polo" ? 174 : 116);
  const centerX = family === "polo" ? 627 : 363;
  const top = family === "polo" ? 405 : family === "hoodie" ? 246 : 210;
  const left = Math.round(centerX - crown.width / 2);
  const ink = dark ? [248, 240, 218] : [24, 26, 25];
  for (let y = 0; y < crown.height; y++) {
    for (let x = 0; x < crown.width; x++) {
      const source = (y * crown.width + x) * 4;
      const dest = ((top + y) * width + left + x) * 4;
      const opacity = crown.pixels[source + 3] / 255 * 0.94;
      if (opacity === 0 || output[dest + 3] === 0) continue;
      const shade = Math.min(1.1, (pixels[dest] + pixels[dest + 1] + pixels[dest + 2]) / (3 * 235));
      for (let channel = 0; channel < 3; channel++) {
        output[dest + channel] = Math.round(output[dest + channel] * (1 - opacity) + ink[channel] * shade * opacity);
      }
    }
  }

  return sharp(output, { raw: { width, height, channels: 4 } }).webp({ quality: 86 }).toBuffer();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const family = params.get("family") ?? "";
  const color = params.get("color") ?? "";
  if (!Object.hasOwn(sources, family) || !/^[\da-f]{6}$/i.test(color)) {
    return new Response("Invalid catalog preview", { status: 400 });
  }
  try {
    const preview = await render(family, color);
    return new Response(new Uint8Array(preview), { headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000",
    } });
  } catch {
    return new Response("Catalog preview unavailable", { status: 500 });
  }
}
