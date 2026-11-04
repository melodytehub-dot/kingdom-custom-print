import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  try {
    const [product] = await sql<{ sale_mode: string }[]>`SELECT sale_mode FROM products WHERE id = ${id} AND active = true`;
    if (!product || product.sale_mode !== "ready-made") return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const rows = await sql<{ color: string; size: string; available: number }[]>`
      SELECT c.slug AS color, s.label AS size,
        GREATEST(0, COALESCE(stock.quantity, 0) - COALESCE((
          SELECT sum(r.quantity) FROM inventory_reservations r
          WHERE r.product_id = c.product_id AND r.color_name = c.name AND r.size_label = s.label
        ), 0))::int AS available
      FROM product_colors c JOIN product_sizes s ON s.product_id = c.product_id
      LEFT JOIN inventory_stock stock ON stock.product_id = c.product_id AND stock.color_name = c.name AND stock.size_label = s.label
      WHERE c.product_id = ${id}`;
    return NextResponse.json({ options: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Availability is temporarily unavailable." }, { status: 503 });
  }
}
