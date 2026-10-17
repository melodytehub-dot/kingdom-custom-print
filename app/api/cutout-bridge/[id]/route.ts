import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Serves a parked photo so imgix can fetch it during hosted background
 * removal. Random private ids; rows are swept after a day by the POST.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9]{32}$/.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const rows = await sql<{ content_type: string; bytes: Buffer }[]>`
    SELECT content_type, bytes FROM cutout_bridge_images WHERE id = ${id}
  `;
  const row = rows[0];
  if (!row) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.content_type,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
