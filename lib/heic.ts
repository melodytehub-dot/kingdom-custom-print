/* -------------------------------------------------------------------------
   iPhone HEIC/HEIF uploads

   iPhones photograph in HEIC by default, and browsers (outside Safari) cannot
   decode it — uploads failed with "not an image" or "could not be decoded"
   depending on how Windows and Android report the file. The leading bytes of
   every upload are sniffed (32 bytes, cheap) so renamed HEICs are caught too,
   and `heic-to` (libheif compiled to WebAssembly) converts the photo to JPEG
   for the normal pipeline. The decoder is ~3 MB, so it is imported lazily —
   JPEG/PNG uploads never download it.

   If this app ever ships a Content-Security-Policy that forbids eval, switch
   the conversion import to `heic-to/csp` (see the package README).
   ------------------------------------------------------------------------- */

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

/** True when the first bytes are a HEIF photo container. */
export function looksLikeHeic(head: Uint8Array): boolean {
  if (head.length < 12) return false;
  const box = String.fromCharCode(head[4], head[5], head[6], head[7]);
  const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
  return box === "ftyp" && HEIC_BRANDS.has(brand);
}

/**
 * Whether an upload is HEIC/HEIF. A declared HEIC type is trusted, but the
 * bytes are sniffed as well because renamed photos (a .jpg that actually
 * holds HEIC data) and vague file types are common.
 */
export async function isHeicUpload(file: File): Promise<boolean> {
  if (/^image\/hei[cf]/i.test(file.type)) return true;
  try {
    const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    return looksLikeHeic(head);
  } catch {
    return false;
  }
}

/** Converts a HEIC/HEIF upload into a JPEG the normal pipeline can read. */
export async function convertHeicUpload(file: File): Promise<File> {
  const { heicTo } = await import("heic-to");
  const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  const name = file.name.replace(/\.(heic|heif)$/i, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
