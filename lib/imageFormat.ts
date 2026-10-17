/* -------------------------------------------------------------------------
   What an upload really is

   Phone file pickers, chat apps and Windows mislabel files often enough —
   a JPEG handed over as "application/octet-stream", an iPhone photo as
   "not an image", a chat-forwarded HEIC renamed to .jpg — that the declared
   MIME type is the least trustworthy thing about an upload. The leading
   bytes are sniffed instead; the declared type is only consulted when the
   bytes say nothing (plain SVG text, an empty or broken head).
   ------------------------------------------------------------------------- */

export type ImageFormat =
  | "jpeg"
  | "png"
  | "webp"
  | "avif"
  | "heic"
  | "gif"
  | "svg"
  | "bmp"
  | "tiff"
  | "unknown";

/** ISO-BMFF brands that mean "HEIC/HEIF photo" (what an iPhone writes). */
const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "heif",
]);

/** ISO-BMFF brands that mean "AVIF" (still or sequence). */
const AVIF_BRANDS = new Set(["avif", "avis"]);

function latin(head: Uint8Array, start: number, length: number): string {
  let out = "";
  const end = Math.min(start + length, head.length);
  for (let i = start; i < end; i++) out += String.fromCharCode(head[i]);
  return out;
}

/** Reads a file's leading bytes as a format, ignoring its name and type. */
export function sniffImageFormat(head: Uint8Array): ImageFormat {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (head.length >= 8 && head[0] === 0x89 && latin(head, 1, 3) === "PNG") return "png";
  if (head.length >= 12) {
    if (latin(head, 0, 4) === "RIFF" && latin(head, 8, 4) === "WEBP") return "webp";
    if (latin(head, 4, 4) === "ftyp") {
      const brand = latin(head, 8, 4);
      if (AVIF_BRANDS.has(brand)) return "avif";
      if (HEIC_BRANDS.has(brand)) return "heic";
    }
  }
  if (head.length >= 3 && latin(head, 0, 3) === "GIF") return "gif";
  if (head.length >= 2 && latin(head, 0, 2) === "BM") return "bmp";
  // TIFF: "II*\0" (little-endian) or "MM\0*" (big-endian).
  if (head.length >= 4 && head[0] === 0x49 && head[1] === 0x49 && head[2] === 0x2a) return "tiff";
  if (head.length >= 4 && head[0] === 0x4d && head[1] === 0x4d && head[3] === 0x2a) return "tiff";
  const text = latin(head, 0, 512).trimStart().toLowerCase();
  if (
    text.startsWith("<svg") ||
    ((text.startsWith("<?xml") || text.startsWith("<!--") || text.startsWith("<!doctype")) &&
      /<svg[\s>]/.test(text))
  ) {
    return "svg";
  }
  return "unknown";
}

/** Maps a declared MIME type to a format, for when the bytes are inconclusive. */
export function formatFromType(type: string): ImageFormat {
  switch (type.toLowerCase().trim()) {
    case "image/jpeg":
    case "image/jpg":
    case "image/pjpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/heic":
    case "image/heif":
    case "image/heic-sequence":
    case "image/heif-sequence":
      return "heic";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/bmp":
    case "image/x-ms-bmp":
      return "bmp";
    case "image/tiff":
      return "tiff";
    default:
      return "unknown";
  }
}

/**
 * Reads the first bytes of a file. Falls back to FileReader where
 * Blob.arrayBuffer is missing (old in-app browsers).
 */
export async function readFileHead(file: Blob, bytes = 512): Promise<Uint8Array> {
  const slice = file.slice(0, bytes);
  try {
    return new Uint8Array(await slice.arrayBuffer());
  } catch {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new Uint8Array(reader.result as ArrayBuffer).subarray(0, bytes));
      reader.onerror = () => resolve(new Uint8Array());
      reader.readAsArrayBuffer(slice);
    });
  }
}

/** The truth about an upload: the bytes win, the declared type fills gaps. */
export async function detectImageFormat(file: File): Promise<ImageFormat> {
  const sniffed = sniffImageFormat(await readFileHead(file));
  return sniffed === "unknown" ? formatFromType(file.type) : sniffed;
}

/** Short human label used in error messages ("That PNG could not..."). */
export function formatLabel(format: ImageFormat): string {
  switch (format) {
    case "jpeg":
      return "JPG";
    case "png":
      return "PNG";
    case "webp":
      return "WEBP";
    case "avif":
      return "AVIF";
    case "heic":
      return "HEIC";
    case "gif":
      return "GIF";
    case "svg":
      return "SVG";
    case "bmp":
      return "BMP";
    case "tiff":
      return "TIFF";
    default:
      return "file";
  }
}
