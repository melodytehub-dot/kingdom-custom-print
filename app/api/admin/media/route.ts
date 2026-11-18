import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { limitedJson } from "@/lib/limited-form-data";
import {
  deleteUploadedMedia,
  listMediaLibrary,
  updateMediaMeta,
} from "@/lib/media-library";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json(await listMediaLibrary());
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { id?: unknown; name?: unknown; alt?: unknown };
  try {
    body = (await limitedJson(req, 8192)) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const ok = await updateMediaMeta(id, {
    ...(typeof body.name === "string" ? { name: body.name } : {}),
    ...(typeof body.alt === "string" ? { alt: body.alt } : {}),
  });
  if (!ok) {
    return NextResponse.json({ error: "Select a valid photo first." }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const result = await deleteUploadedMedia(id);
  if (!result.ok) {
    if (result.reason === "in-use") {
      return NextResponse.json(
        { error: "This photo is currently used by a product, homepage, or page. Replace it there before deleting." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Select a valid uploaded photo." }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
