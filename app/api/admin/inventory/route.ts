import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  const id = Number(new URL(req.url).searchParams.get("product"));
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Choose a product." }, { status: 422 });
  try {
    const [rows, history, controls] = await Promise.all([
      sql`SELECT s.color_name, s.size_label, s.quantity, s.updated_at, COALESCE((SELECT sum(r.quantity) FROM inventory_reservations r WHERE r.product_id = s.product_id AND r.color_name = s.color_name AND r.size_label = s.size_label), 0)::int AS reserved FROM inventory_stock s WHERE s.product_id = ${id}`,
      sql`SELECT color_name, size_label, previous_quantity, new_quantity, created_at FROM inventory_adjustments WHERE product_id = ${id} ORDER BY id DESC LIMIT 30`,
      sql`SELECT enabled FROM inventory_control WHERE id = true`,
    ]);
    return NextResponse.json({ counts: rows, history, enabled: controls[0]?.enabled === true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Inventory is temporarily unavailable." }, { status: 503 }); }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  let body: { enabled?: unknown };
  try { body = await req.json(); if (!body || typeof body.enabled !== "boolean") throw new Error(); }
  catch { return NextResponse.json({ error: "Choose whether to enable stock protection." }, { status: 422 }); }
  const enabled = body.enabled as boolean;
  try {
    await sql.begin(async (tx) => {
      const [control] = await tx<{ enabled: boolean }[]>`SELECT enabled FROM inventory_control WHERE id = true FOR UPDATE`;
      if (!control) throw new Error("unavailable");
      if (control.enabled === enabled) return;
      if (enabled) {
        const duplicateColors = await tx`SELECT 1 FROM product_colors c JOIN products p ON p.id = c.product_id WHERE p.active = true GROUP BY c.product_id, c.name HAVING count(*) > 1 LIMIT 1`;
        if (duplicateColors.length) throw new Error("duplicates");
        const [coverage] = await tx<{ total: number; missing: number }[]>`SELECT count(*)::int AS total, count(*) FILTER (WHERE i.product_id IS NULL)::int AS missing FROM products p JOIN product_colors c ON c.product_id = p.id JOIN product_sizes s ON s.product_id = p.id LEFT JOIN inventory_stock i ON i.product_id = p.id AND i.color_name = c.name AND i.size_label = s.label WHERE p.active = true`;
        if (!coverage.total || coverage.missing) throw new Error("counts");
        const [pending] = await tx<{ count: number }[]>`SELECT count(*)::int AS count FROM orders WHERE status = 'pending' OR (status = 'cancelled' AND (stripe_session_id IS NOT NULL OR paypal_order_id IS NOT NULL) AND NOT inventory_provider_closed)`;
        if (pending.count) throw new Error("pending");
      } else {
        const held = await tx`SELECT 1 FROM inventory_reservations LIMIT 1`;
        if (held.length) throw new Error("held");
      }
      await tx`UPDATE inventory_control SET enabled = ${enabled} WHERE id = true`;
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "counts") return NextResponse.json({ error: "Enter a stock count for every color and size of each active product before enabling protection." }, { status: 409 });
    if (reason === "duplicates") return NextResponse.json({ error: "Active products need distinct color names before stock protection can be enabled." }, { status: 409 });
    if (reason === "pending") return NextResponse.json({ error: "Existing pending or cancelled payment sessions need reconciliation before stock protection can be enabled. Contact the site administrator." }, { status: 409 });
    if (reason === "held") return NextResponse.json({ error: "Stock is held for pending orders. Resolve those orders before turning protection off." }, { status: 409 });
    return NextResponse.json({ error: "Stock protection could not be updated." }, { status: 503 });
  }
}

type Count = { color: string; size: string; quantity: number; expected: number | null };
export async function PUT(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  let body: { productId?: unknown; counts?: unknown };
  try { body = await req.json(); if (!body || typeof body !== "object") throw new Error(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = body.productId;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || !Array.isArray(body.counts) || !body.counts.length || body.counts.length > 4000) return NextResponse.json({ error: "Choose a product and enter counts to save." }, { status: 422 });
  const counts: Count[] = [];
  const unique = new Set<string>();
  for (const raw of body.counts) {
    if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Check the stock counts." }, { status: 422 });
    const row = raw as Record<string, unknown>;
    if (typeof row.color !== "string" || typeof row.size !== "string" || typeof row.quantity !== "number" || !Number.isSafeInteger(row.quantity) || row.quantity < 0 || row.quantity > 1000000 || !(row.expected === null || (typeof row.expected === "number" && Number.isSafeInteger(row.expected) && row.expected >= 0))) return NextResponse.json({ error: "Counts must be whole numbers between 0 and 1,000,000." }, { status: 422 });
    const key = JSON.stringify([row.color, row.size]);
    if (unique.has(key)) return NextResponse.json({ error: "A variant was entered more than once." }, { status: 422 });
    unique.add(key); counts.push({ color: row.color, size: row.size, quantity: row.quantity, expected: row.expected as number | null });
  }
  try {
    await sql.begin(async (tx) => {
      // Serialize count edits for a product, including creation of a new row.
      await tx`SELECT pg_advisory_xact_lock(1296786772, ${id})`;
      const [product] = await tx<{ name: string }[]>`SELECT name FROM products WHERE id = ${id} FOR SHARE`;
      if (!product) throw new Error("variant");
      const colors = await tx<{ name: string }[]>`SELECT name FROM product_colors WHERE product_id = ${id}`;
      const sizes = await tx<{ label: string }[]>`SELECT label FROM product_sizes WHERE product_id = ${id}`;
      for (const row of counts) {
        if (!colors.some((c) => c.name === row.color) || !sizes.some((s) => s.label === row.size)) throw new Error("variant");
        const [current] = await tx<{ quantity: number }[]>`SELECT quantity FROM inventory_stock WHERE product_id = ${id} AND color_name = ${row.color} AND size_label = ${row.size} FOR UPDATE`;
        const previous = current?.quantity ?? null;
        if (previous !== row.expected) throw new Error("conflict");
        const [held] = await tx<{ quantity: number }[]>`SELECT COALESCE(sum(quantity), 0)::int AS quantity FROM inventory_reservations WHERE product_id = ${id} AND color_name = ${row.color} AND size_label = ${row.size}`;
        if (row.quantity < held.quantity) throw new Error("reserved");
        if (previous === row.quantity) continue;
        await tx`INSERT INTO inventory_stock (product_id, color_name, size_label, quantity) VALUES (${id}, ${row.color}, ${row.size}, ${row.quantity}) ON CONFLICT (product_id, color_name, size_label) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`;
        await tx`INSERT INTO inventory_adjustments (product_id, product_name, color_name, size_label, previous_quantity, new_quantity) VALUES (${id}, ${product.name}, ${row.color}, ${row.size}, ${previous}, ${row.quantity})`;
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "conflict") return NextResponse.json({ error: "These counts changed elsewhere. Reload inventory before saving." }, { status: 409 });
    if (error instanceof Error && error.message === "variant") return NextResponse.json({ error: "The product options have changed. Reload inventory before saving." }, { status: 409 });
    if (error instanceof Error && error.message === "reserved") return NextResponse.json({ error: "A count cannot be lower than the quantity held for pending orders." }, { status: 409 });
    return NextResponse.json({ error: "Inventory could not be saved." }, { status: 503 });
  }
}
