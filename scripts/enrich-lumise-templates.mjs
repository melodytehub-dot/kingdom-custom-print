import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve, sep } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const archivePath = resolve(args.get("--archive") ?? "");
const manifestPath = resolve(args.get("--manifest") ?? "public/lumise/templates.json");
const publicRoot = resolve("public");
const assetRoot = resolve("public/lumise/template-elements");
if (!args.has("--archive") || !existsSync(archivePath) || !existsSync(manifestPath)) {
  console.error("Usage: node scripts/enrich-lumise-templates.mjs --archive <lumise_data.zip> [--manifest public/lumise/templates.json]");
  process.exit(1);
}

const tempRoot = mkdtempSync(join(tmpdir(), "kingdom-lumise-templates-"));
const fontFamilies = new Set();
const fontToken = (family) => {
  const builtin = new Map([["anton", "anton"], ["montserrat", "montserrat"], ["oswald", "oswald"], ["playfair display", "playfair"]]);
  const normalized = String(family).trim().toLowerCase();
  return builtin.get(normalized) ?? `google-${normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
};
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const safeId = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "-");

function decodeDataUri(uri) {
  const match = String(uri ?? "").match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/i);
  if (!match) return null;
  const [, mime, base64, payload] = match;
  const bytes = base64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  const extension = mime.toLowerCase() === "image/svg+xml"
    ? "svg"
    : mime.toLowerCase().split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  return { bytes, extension };
}

function writeElementAsset(templateId, index, source) {
  const decoded = decodeDataUri(source);
  if (!decoded || !["svg", "png", "jpg", "webp", "gif"].includes(decoded.extension)) return null;
  const file = `${safeId(templateId)}-${index}.${decoded.extension}`;
  const absolute = join(assetRoot, file);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, decoded.bytes);
  return `/lumise/template-elements/${file}`;
}

function getTemplateSource(previewSrc) {
  const rel = String(previewSrc ?? "")
    .replace(/^\/lumise\//, "")
    .replace(/-thumbn(?:-\d+)?\.png$/i, ".lumi");
  if (rel === previewSrc || rel.split(/[\\/]/).includes("..")) return null;
  const path = resolve(tempRoot, rel);
  if (!path.startsWith(`${tempRoot}${sep}`) || !existsSync(path)) return null;
  return path;
}

function normalizeText(object, zone) {
  const fontFamily = String(object.fontFamily ?? object.font ?? "Anton").replaceAll("+", " ").trim() || "Anton";
  fontFamilies.add(fontFamily);
  const fontSizePx = Math.max(1, number(object.fontSize, 32));
  const fill = typeof object.fill === "string" ? object.fill : "#141414";
  const stroke = typeof object.stroke === "string" ? object.stroke : fill;
  const strokePx = Math.max(0, number(object.strokeWidth, 0));
  const base = {
    text: String(object.text ?? ""),
    x: (number(object.left, zone.left + zone.width / 2) - number(zone.left, 0)) / zone.width * 100,
    y: (number(object.top, zone.top + zone.height / 2) - number(zone.top, 0)) / zone.height * 100,
    scaleX: Math.max(0.05, Math.abs(number(object.scaleX, 1))),
    scaleY: Math.max(0.05, Math.abs(number(object.scaleY, 1))),
    rotation: number(object.angle, 0),
    opacity: Math.max(0, Math.min(1, number(object.opacity, 1))),
    flipH: Boolean(object.flipX),
    flipV: Boolean(object.flipY),
    font: fontToken(fontFamily),
    fontSize: Math.max(1, fontSizePx / zone.height * 100),
    color: fill,
    weight: object.fontWeight === "bold" || Number(object.fontWeight) >= 800 ? 900
      : object.fontWeight === "bold" || Number(object.fontWeight) >= 600 ? 700 : 400,
    italic: object.fontStyle === "italic",
    uppercase: false,
    align: ["left", "right"].includes(object.textAlign) ? object.textAlign : "center",
    letterSpacing: number(object.charSpacing, 0) / fontSizePx * 100,
    lineHeight: Math.max(0.5, Math.min(3, number(object.lineHeight, 1.05))),
    strokeColor: stroke,
    strokeWidth: strokePx / fontSizePx * 100,
    arc: 0,
  };

  if (object.type === "curvedText" && number(object.radius, 0) > 0) {
    const curve = Math.min(100, Math.round((fontSizePx / number(object.radius, 1)) * 100));
    base.arc = object.reverse ? -curve : curve;
  }
  if (!base.text.trim()) return null;
  return { type: "text", layer: base };
}

function normalizeArtwork(object, zone, template, index) {
  const src = object.src ?? object._element?.src ?? object._originalElement?.src;
  const localSrc = writeElementAsset(template.id, index, src);
  if (!localSrc) return null;

  const width = Math.max(1, number(object.width, 1));
  const height = Math.max(1, number(object.height, 1));
  const aspect = width / height;
  const objectWidthPct = width * Math.abs(number(object.scaleX, 1)) / zone.width * 100;
  const objectHeightPct = height * Math.abs(number(object.scaleY, 1)) / zone.height * 100;
  // The editor image layer's base box fits the full printable area. Convert
  // Lumise's source-pixel geometry into independent normalized width/height
  // scales so the imported placement survives product aspect-ratio changes.
  const aspectRatio = zone.width / zone.height;
  const baseWidthPct = Math.min(100, aspect * 100 / aspectRatio);
  const baseHeightPct = Math.min(100, 100 * aspectRatio / aspect);
  return {
    type: "art",
    layer: {
      src: localSrc,
      name: String(object.name ?? object.title ?? `${template.name} artwork ${index + 1}`),
      aspect,
      x: (number(object.left, zone.left + zone.width / 2) - number(zone.left, 0)) / zone.width * 100,
      y: (number(object.top, zone.top + zone.height / 2) - number(zone.top, 0)) / zone.height * 100,
      scaleX: Math.max(0.05, objectWidthPct / baseWidthPct),
      scaleY: Math.max(0.05, objectHeightPct / baseHeightPct),
      rotation: number(object.angle, 0),
      opacity: Math.max(0, Math.min(1, number(object.opacity, 1))),
      flipH: Boolean(object.flipX),
      flipV: Boolean(object.flipY),
    },
  };
}

try {
  execFileSync("tar", ["-xf", archivePath, "-C", tempRoot, "templates"], { stdio: "inherit" });
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const missing = [];
  let editableCount = 0;
  let textCount = 0;
  let artCount = 0;

  for (const template of manifest.items) {
    const sourcePath = getTemplateSource(template.previewSrc);
    if (!sourcePath) {
      missing.push(`${template.id}: source file missing`);
      continue;
    }
    try {
      const rawSource = readFileSync(sourcePath, "utf8").trim();
      const source = JSON.parse(rawSource.startsWith("%7B") ? decodeURIComponent(rawSource) : rawSource);
      const stage = source.stages?.lumise;
      const rawDesign = typeof stage?.data === "string" ? stage.data : stage?.data;
      const design = typeof rawDesign === "string"
        ? JSON.parse(rawDesign.startsWith("%7B") ? decodeURIComponent(rawDesign) : rawDesign)
        : rawDesign;
      const zone = design?.limit_zone;
      if (!Array.isArray(design?.objects) || !(number(zone?.width, 0) > 0) || !(number(zone?.height, 0) > 0)) {
        missing.push(`${template.id}: invalid Lumise layer data`);
        continue;
      }

      const elements = [];
      for (const [index, object] of design.objects.entries()) {
        if (!object || typeof object !== "object") continue;
        const type = String(object.type ?? "").toLowerCase();
        const element = ["i-text", "textbox", "text", "curvedtext", "text-fx"].includes(type)
          ? normalizeText(object, zone)
          : ["image", "svg"].includes(type)
            ? normalizeArtwork(object, zone, template, index)
            : null;
        if (!element) continue;
        elements.push(element);
        if (element.type === "text") textCount += 1;
        else artCount += 1;
      }

      if (elements.length) {
        template.elements = elements;
        template.editableElementCount = elements.length;
        editableCount += 1;
      } else {
        missing.push(`${template.id}: no supported editable objects`);
      }
    } catch (error) {
      missing.push(`${template.id}: ${error instanceof Error ? error.message : "could not parse source"}`);
    }
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  writeFileSync(join(resolve("public/lumise"), "template-fonts.json"), `${JSON.stringify([...fontFamilies].sort())}\n`);
  console.log(`Enriched ${editableCount}/${manifest.items.length} templates (${textCount} editable text layers, ${artCount} artwork layers).`);
  if (missing.length) console.warn(`${missing.length} templates need thumbnail fallback. First entries: ${missing.slice(0, 12).join("; ")}`);
  console.log(`Found ${fontFamilies.size} Lumise font families; wrote public/lumise/template-fonts.json.`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
