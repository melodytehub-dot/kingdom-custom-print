import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { limitedFormData } from "@/lib/limited-form-data";
import { sniffImageFormat } from "@/lib/imageFormat";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
// D1 caps a row at 2 MB, so uploaded photos stay comfortably under it.
const LIMIT = 1_900_000;

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const form = await limitedFormData(req, LIMIT + 16384);
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0 || file.size > LIMIT) {
      return NextResponse.json({ error: "Choose a photo under 2 MB." }, { status: 422 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = sniffImageFormat(bytes.slice(0, 512));
    const mime = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : format === "webp" ? "image/webp" : null;
    if (!mime) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 422 });
    const id = randomUUID();
    await sql`INSERT INTO catalog_media (id, content_type, content) VALUES (${id}, ${mime}, ${bytes})`;
    return NextResponse.json({ url: `/api/product-media/${id}` });
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: "Choose a photo under 2 MB." }, { status: 413 });
    console.error("Product photo upload failed", error);
    return NextResponse.json({ error: "The photo could not be uploaded. Try again." }, { status: 500 });
  }
}


