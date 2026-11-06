import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { sql } from "@/lib/db";
import { validateQuote } from "@/lib/admin-quotes";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  try {
    const rows = await sql`SELECT q.id::text, q.customer_name, q.customer_email, q.notes, q.lines, q.shipping_cents, q.status, q.created_at, q.invoiced_at, p.state AS payment_state, p.provider AS payment_provider FROM admin_quotes q LEFT JOIN LATERAL (SELECT state, provider FROM invoice_payment_attempts WHERE quote_id = q.id AND state IN ('creating', 'open', 'paid', 'refunded') ORDER BY created_at DESC LIMIT 1) p ON true ORDER BY q.id DESC LIMIT 200`;
    return NextResponse.json({ quotes: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Quotes are temporarily unavailable." }, { status: 503 }); }
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const result = validateQuote(body);
  if (!result.value) return NextResponse.json({ error: result.error }, { status: 422 });
  const { name, email, notes, lines, shippingCents } = result.value;
  try {
    const [row] = await sql`INSERT INTO admin_quotes (customer_name, customer_email, notes, lines, shipping_cents) VALUES (${name}, ${email}, ${notes}, ${sql.json(lines)}, ${shippingCents}) RETURNING id::text`;
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch { return NextResponse.json({ error: "Could not save this quote." }, { status: 503 }); }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  let body: Record<string, unknown>; try { body = await req.json(); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = String(body.id ?? "");
  if (!/^[1-9][0-9]{0,15}$/.test(id)) return NextResponse.json({ error: "Quote not found." }, { status: 422 });
  try {
    if (body.action === "invoice") {
      const rows = await sql`UPDATE admin_quotes SET status = 'invoice', invoiced_at = now(), updated_at = now() WHERE id = ${id}::bigint AND status = 'quote' AND customer_email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$' RETURNING id`;
      return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Quote not found, already converted, or missing a valid customer email. Edit the quote and add an email first." }, { status: 409 });
    }
    const result = validateQuote(body);
    if (!result.value) return NextResponse.json({ error: result.error }, { status: 422 });
    const { name, email, notes, lines, shippingCents } = result.value;
    const rows = await sql`UPDATE admin_quotes SET customer_name = ${name}, customer_email = ${email}, notes = ${notes}, lines = ${sql.json(lines)}, shipping_cents = ${shippingCents}, updated_at = now() WHERE id = ${id}::bigint AND status = 'quote' RETURNING id`;
    return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Quote not found or already converted." }, { status: 409 });
  } catch { return NextResponse.json({ error: "Could not update this quote." }, { status: 503 }); }
}
