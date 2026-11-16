import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authAttemptAllowed, sameOrigin } from "@/lib/customer-auth";
import { limitedFormData } from "@/lib/limited-form-data";
import { putMedia, sweepExpiredCutout } from "@/lib/media-storage";

export const runtime = "nodejs";

/**
 * Upload for hosted background removal.
 *
 * imgix renders `bg-remove` by fetching the original photo from a public URL,
 * so a photo the editor is cutting out is parked in R2 under a random id and
 * served back by the sibling GET route; imgix fetches it from there. Objects are
 * swept after a day.
 */
const MAX_BYTES = 10_000_000;
const CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  try {
    if (!(await authAttemptAllowed(request, "__cutout_upload__", 30))) return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
  } catch { return NextResponse.json({ error: "Uploads are temporarily unavailable." }, { status: 503 }); }
  let form: FormData;
  try {
    form = await limitedFormData(request, MAX_BYTES + 65_536);
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: "Keep the photo under 10 MB." }, { status: 413 });
    return NextResponse.json({ error: "Send the photo as form data." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo was sent." }, { status: 400 });
  }
  const contentType = file.type || "image/jpeg";
  if (!CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Keep the photo under 10 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = randomBytes(16).toString("hex");

  await putMedia("cutout", id, bytes, contentType);
  await sweepExpiredCutout().catch(() => {});

  return NextResponse.json({ id, path: `/api/cutout-bridge/${id}` });
}



