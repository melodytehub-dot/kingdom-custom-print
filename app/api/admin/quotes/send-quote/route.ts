import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../_guard";
import { authAttemptAllowed } from "@/lib/customer-auth";
import { emailConfigured, sendEmail } from "@/lib/email";
import { getSettings } from "@/lib/catalog";
import { publicSiteUrl } from "@/lib/site-url";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await requireAdmin(req); if (denied) return denied;
  if (!(await authAttemptAllowed(req, "__quote_email__"))) return NextResponse.json({ error: "Too many email requests. Try again later." }, { status: 429 });
  let body: { id?: unknown }; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = String(body?.id ?? "");
  if (!/^[1-9][0-9]{0,15}$/.test(id)) return NextResponse.json({ error: "Quote not found." }, { status: 422 });
  if (!emailConfigured()) return NextResponse.json({ error: "Email is temporarily unavailable." }, { status: 503 });
  try {
    const [quote] = await sql<{ customer_name: string; customer_email: string }[]>`SELECT customer_name, customer_email FROM admin_quotes WHERE id = ${id}::bigint AND status = 'quote'`;
    if (!quote) return NextResponse.json({ error: "Quote not found or already converted." }, { status: 404 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quote.customer_email)) return NextResponse.json({ error: "Add a valid customer email to the quote first." }, { status: 422 });
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    // Copy the quote in the database, atomically with checking that it is still editable.
    const saved = await sql`INSERT INTO quote_share_tokens (token_hash, quote_id, snapshot, expires_at)
      SELECT ${hash}, id, jsonb_build_object('id', id::text, 'customer_name', customer_name, 'customer_email', customer_email, 'notes', notes, 'lines', lines, 'shipping_cents', shipping_cents, 'created_at', created_at), now() + interval '30 days'
      FROM admin_quotes WHERE id = ${id}::bigint AND status = 'quote' AND customer_email = ${quote.customer_email} RETURNING quote_id`;
    if (!saved.length) return NextResponse.json({ error: "The quote changed. Refresh and try again." }, { status: 409 });
    const url = `${publicSiteUrl()}/quote/${token}`;
    const settings = await getSettings();
    await sendEmail({ to: quote.customer_email, subject: `Your Kingdom Custom Print quote #${id}`, text: `Hi ${quote.customer_name},\n\nYour quote is ready to review. This link expires in 30 days.\n\n${url}\n\nPlease reply to this email if you have questions or would like to proceed.`, replyTo: settings.contactEmail || undefined, action: { label: "View quote", url } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "The email could not be confirmed. Please try again later." }, { status: 503 }); }
}
