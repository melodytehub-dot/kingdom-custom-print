import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { sql, num } from "@/lib/db";
import { isGuardFailure } from "@/lib/inventory-reservations";
import type { SqlFragment } from "@/lib/sqlite";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  const params = new URL(req.url).searchParams;
  if (params.get("summary") === "1") {
    try {
      const [rows, controls] = await Promise.all([
        sql<{ id: number; total: number; counted: number }[]>`SELECT p.id, count(*) AS total, count(i.product_id) AS counted FROM products p JOIN product_colors c ON c.product_id = p.id JOIN product_sizes s ON s.product_id = p.id LEFT JOIN inventory_stock i ON i.product_id = p.id AND i.color_name = c.name AND i.size_label = s.label WHERE p.active = 1 GROUP BY p.id ORDER BY p.id`,
        sql<{ enabled: number }[]>`SELECT enabled FROM inventory_control WHERE id = 1`,
      ]);
      return NextResponse.json({ products: rows, enabled: Boolean(controls[0]?.enabled) }, { headers: { "Cache-Control": "no-store" } });
    } catch { return NextResponse.json({ error: "Inventory summary is temporarily unavailable." }, { status: 503 }); }
  }
  const id = Number(params.get("product"));
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Choose a product." }, { status: 422 });
  try {
    const [rows, history, controls] = await Promise.all([
      sql`SELECT s.color_name, s.size_label, s.quantity, s.updated_at, COALESCE((SELECT sum(r.quantity) FROM inventory_reservations r WHERE r.product_id = s.product_id AND r.color_name = s.color_name AND r.size_label = s.size_label), 0) AS reserved FROM inventory_stock s WHERE s.product_id = ${id}`,
      sql`SELECT color_name, size_label, previous_quantity, new_quantity, created_at FROM inventory_adjustments WHERE product_id = ${id} ORDER BY id DESC LIMIT 30`,
      sql<{ enabled: number }[]>`SELECT enabled FROM inventory_control WHERE id = 1`,
    ]);
    return NextResponse.json({ counts: rows, history, enabled: Boolean(controls[0]?.enabled) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Inventory is temporarily unavailable." }, { status: 503 }); }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  let body: { enabled?: unknown };
  try { body = await req.json(); if (!body || typeof body.enabled !== "boolean") throw new Error(); }
  catch { return NextResponse.json({ error: "Choose whether to enable stock protection." }, { status: 422 }); }
  const enabled = body.enabled as boolean;
  try {
    const [control] = await sql<{ enabled: number }[]>`SELECT enabled FROM inventory_control WHERE id = 1`;
    if (!control) throw new Error("unavailable");
    if (Boolean(control.enabled) === enabled) return NextResponse.json({ ok: true });
    if (enabled) {
      const duplicateColors = await sql`SELECT 1 FROM product_colors c JOIN products p ON p.id = c.product_id WHERE p.active = 1 GROUP BY c.product_id, c.name HAVING count(*) > 1 LIMIT 1`;
      if (duplicateColors.length) throw new Error("duplicates");
      const [pending] = await sql<{ count: number }[]>`SELECT count(*) AS count FROM orders WHERE status = 'pending' OR (status = 'cancelled' AND (stripe_session_id IS NOT NULL OR paypal_order_id IS NOT NULL) AND inventory_provider_closed = 0)`;
      if (num(pending?.count)) throw new Error("pending");
    } else {
      const held = await sql`SELECT 1 FROM inventory_reservations LIMIT 1`;
      if (held.length) throw new Error("held");
    }
    const updated = await sql`
      UPDATE inventory_control SET enabled = ${enabled} WHERE id = 1 AND enabled = ${control.enabled}
      RETURNING id`;
    if (!updated.length) throw new Error("conflict");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "duplicates") return NextResponse.json({ error: "Active products need distinct color names before stock protection can be enabled." }, { status: 409 });
    if (reason === "pending") return NextResponse.json({ error: "Existing pending or cancelled payment sessions need reconciliation before stock protection can be enabled. Contact the site administrator." }, { status: 409 });
    if (reason === "held") return NextResponse.json({ error: "Stock is held for pending orders. Resolve those orders before turning protection off." }, { status: 409 });
    if (reason === "conflict") return NextResponse.json({ error: "Stock protection changed elsewhere. Reload and try again." }, { status: 409 });
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
    const [product] = await sql<{ name: string }[]>`SELECT name FROM products WHERE id = ${id}`;
    if (!product) throw new Error("variant");
    const colors = await sql<{ name: string }[]>`SELECT name FROM product_colors WHERE product_id = ${id}`;
    const sizes = await sql<{ label: string }[]>`SELECT label FROM product_sizes WHERE product_id = ${id}`;

    const statements: SqlFragment[] = [];
    for (const [index, row] of counts.entries()) {
      if (!colors.some((c) => c.name === row.color) || !sizes.some((s) => s.label === row.size)) throw new Error("variant");
      const [current] = await sql<{ quantity: number }[]>`
        SELECT quantity FROM inventory_stock
        WHERE product_id = ${id} AND color_name = ${row.color} AND size_label = ${row.size} LIMIT 1`;
      const previous = current?.quantity ?? null;
      if (previous !== row.expected) throw new Error("conflict");
      const [held] = await sql<{ quantity: number }[]>`
        SELECT COALESCE(sum(quantity), 0) AS quantity FROM inventory_reservations
        WHERE product_id = ${id} AND color_name = ${row.color} AND size_label = ${row.size}`;
      if (row.quantity < num(held?.quantity)) throw new Error("reserved");
      if (previous === row.quantity) continue;

      // Only writes when the count still matches what the admin saw. A null
      // expected value means "no row yet", so a conflict must not update.
      statements.push(sql`
        INSERT INTO inventory_stock (product_id, color_name, size_label, quantity)
        VALUES (${id}, ${row.color}, ${row.size}, ${row.quantity})
        ON CONFLICT (product_id, color_name, size_label) DO UPDATE
          SET quantity = excluded.quantity,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE inventory_stock.quantity = ${row.expected ?? -1}`);
      statements.push(sql`
        INSERT INTO transaction_guards (key, value)
        SELECT ${`stock-count:${index}`}, 0 WHERE changes() <> 1`);
      statements.push(sql`
        INSERT INTO inventory_adjustments
          (product_id, product_name, color_name, size_label, previous_quantity, new_quantity)
        VALUES (${id}, ${product.name}, ${row.color}, ${row.size}, ${previous}, ${row.quantity})`);
    }

    if (statements.length) {
      try {
        await sql.batch(statements);
      } catch (error) {
        throw isGuardFailure(error) ? new Error("conflict") : error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "conflict") return NextResponse.json({ error: "These counts changed elsewhere. Reload inventory before saving." }, { status: 409 });
    if (error instanceof Error && error.message === "variant") return NextResponse.json({ error: "The product options have changed. Reload inventory before saving." }, { status: 409 });
    if (error instanceof Error && error.message === "reserved") return NextResponse.json({ error: "A count cannot be lower than the quantity held for pending orders." }, { status: 409 });
    return NextResponse.json({ error: "Inventory could not be saved." }, { status: 503 });
  }
}
