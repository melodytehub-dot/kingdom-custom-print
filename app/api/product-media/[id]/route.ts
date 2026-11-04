import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return new Response(null, { status: 404 });
  const [photo] = await sql<{ content_type: string; content: Uint8Array }[]>`SELECT content_type, content FROM catalog_media WHERE id = ${id}`;
  if (!photo) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(photo.content), { headers: { "Content-Type": photo.content_type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
