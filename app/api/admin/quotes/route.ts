import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { sql } from "@/lib/db";
import { quoteFromRow, validateQuote, type QuoteRow } from "@/lib/admin-quotes";

export const dynamic = "force-dynamic";

const livePaymentState = sql`(SELECT p.state FROM invoice_payment_attempts p
  WHERE p.quote_id = q.id AND p.state IN ('creating', 'open', 'paid', 'refunded')
  ORDER BY p.created_at DESC LIMIT 1)`;
const livePaymentProvider = sql`(SELECT p.provider FROM invoice_payment_attempts p
  WHERE p.quote_id = q.id AND p.state IN ('creating', 'open', 'paid', 'refunded')
  ORDER BY p.created_at DESC LIMIT 1)`;

export async function GET(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  try {
    const rows = await sql<QuoteRow[]>`
      SELECT q.id, q.customer_name, q.customer_email, q.notes, q.lines, q.shipping_cents,
        q.status, q.created_at, q.invoiced_at,
        ${livePaymentState} AS payment_state,
        ${livePaymentProvider} AS payment_provider
      FROM admin_quotes q
      ORDER BY q.id DESC
      LIMIT 200`;
    return NextResponse.json({ quotes: rows.map(quoteFromRow) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Quotes are temporarily unavailable." }, { status: 503 }); }
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  let body: unknown; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const result = validateQuote(body);
  if (!result.value) return NextResponse.json({ error: result.error }, { status: 422 });
  const { name, email, notes, lines, shippingCents } = result.value;
  try {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO admin_quotes (customer_name, customer_email, notes, lines, shipping_cents)
      VALUES (${name}, ${email}, ${notes}, ${sql.json(lines)}, ${shippingCents})
      RETURNING id`;
    return NextResponse.json({ id: String(row.id) }, { status: 201 });
  } catch { return NextResponse.json({ error: "Could not save this quote." }, { status: 503 }); }
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  let body: Record<string, unknown>; try { body = await req.json(); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = String(body.id ?? "");
  if (!/^[1-9][0-9]{0,15}$/.test(id)) return NextResponse.json({ error: "Quote not found." }, { status: 422 });
  try {
    if (body.action === "invoice") {
      const [current] = await sql<{ customer_email: string }[]>`
        SELECT customer_email FROM admin_quotes WHERE id = ${id} AND status = 'quote' LIMIT 1`;
      if (!current || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current.customer_email)) {
        return NextResponse.json({ error: "Quote not found, already converted, or missing a valid customer email. Edit the quote and add an email first." }, { status: 409 });
      }
      const rows = await sql`
        UPDATE admin_quotes
        SET status = 'invoice',
            invoiced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ${id} AND status = 'quote'
        RETURNING id`;
      return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Quote not found, already converted, or missing a valid customer email. Edit the quote and add an email first." }, { status: 409 });
    }
    const result = validateQuote(body);
    if (!result.value) return NextResponse.json({ error: result.error }, { status: 422 });
    const { name, email, notes, lines, shippingCents } = result.value;
    const rows = await sql`
      UPDATE admin_quotes
      SET customer_name = ${name}, customer_email = ${email}, notes = ${notes},
          lines = ${sql.json(lines)}, shipping_cents = ${shippingCents},
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ${id} AND status = 'quote'
      RETURNING id`;
    return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Quote not found or already converted." }, { status: 409 });
  } catch { return NextResponse.json({ error: "Could not update this quote." }, { status: 503 }); }
}
