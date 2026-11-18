import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { limitedFormData } from "@/lib/limited-form-data";
import { sniffImageFormat } from "@/lib/imageFormat";
import { putMedia } from "@/lib/media-storage";
import { recordUploadedMediaMeta } from "@/lib/media-library";

export const dynamic = "force-dynamic";
const LIMIT = 15_000_000;

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const form = await limitedFormData(req, LIMIT + 16384);
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0 || file.size > LIMIT) {
      return NextResponse.json({ error: "Choose a photo under 15 MB." }, { status: 422 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = sniffImageFormat(bytes.slice(0, 512));
    const mime = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : format === "webp" ? "image/webp" : null;
    if (!mime) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 422 });
    const id = randomUUID();
    await putMedia("product", id, bytes, mime);
    await recordUploadedMediaMeta(id, file.name).catch(() => {});
    return NextResponse.json({ id, url: `/api/product-media/${id}` });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: "Choose a photo under 15 MB." }, { status: 413 });
    console.error("Product photo upload failed", error);
    return NextResponse.json({ error: "The photo could not be uploaded. Try again." }, { status: 500 });
  }
}
