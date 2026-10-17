/* -------------------------------------------------------------------------
   iPhone HEIC/HEIF uploads — conversion

   iPhones photograph in HEIC by default, and browsers (outside Safari) cannot
   decode it. Detection lives in lib/imageFormat.ts (leading bytes, not file
   names — many HEICs arrive renamed or with a vague type). Uploads that sniff
   as HEIC are converted here with `heic-to` (libheif compiled to WebAssembly)
   into JPEG for the normal pipeline. The decoder is ~3 MB, so it is imported
   lazily — JPEG/PNG uploads never download it.

   If this app ever ships a Content-Security-Policy that forbids eval, switch
   the conversion import to `heic-to/csp` (see the package README).
   ------------------------------------------------------------------------- */

/** Converts a HEIC/HEIF upload into a JPEG the normal pipeline can read. */
export async function convertHeicUpload(file: File): Promise<File> {
  const { heicTo } = await import("heic-to");
  const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  const name = file.name.replace(/\.(heic|heif)$/i, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
