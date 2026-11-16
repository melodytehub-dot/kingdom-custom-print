import { NextResponse } from "next/server";
import { readMedia } from "@/lib/media-storage";

export const runtime = "nodejs";

/**
 * Serves a parked photo so imgix can fetch it during hosted background
 * removal. Random private ids; objects are swept after a day.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const row = await readMedia("cutout", id);
  if (!row) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
