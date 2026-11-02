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
  if (!(await authAttemptAllowed(req, "__invoice_email__"))) return NextResponse.json({ error: "Too many email requests. Try again later." }, { status: 429 });
  let body: { id?: unknown }; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const id = String(body?.id ?? "");
  if (!/^[1-9][0-9]{0,15}$/.test(id)) return NextResponse.json({ error: "Invoice not found." }, { status: 422 });
  if (!emailConfigured()) return NextResponse.json({ error: "Email is temporarily unavailable." }, { status: 503 });
  try {
    const [invoice] = await sql<{ customer_name: string; customer_email: string }[]>`SELECT customer_name, customer_email FROM admin_quotes WHERE id = ${id}::bigint AND status = 'invoice'`;
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoice.customer_email)) return NextResponse.json({ error: "This invoice has no valid customer email. Add it to the quote before creating the invoice." }, { status: 422 });
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    await sql`INSERT INTO invoice_share_tokens (token_hash, quote_id, expires_at) VALUES (${hash}, ${id}::bigint, now() + interval '30 days')`;
    const url = `${publicSiteUrl()}/invoice/${token}`;
    const settings = await getSettings();
    await sendEmail({ to: invoice.customer_email, subject: `Your Kingdom Custom Print invoice #${id}`, text: `Hi ${invoice.customer_name},\n\nYour invoice is ready to review. This link expires in 30 days.\n\n${url}\n\nIf you have questions, please reply to this email.`, replyTo: settings.contactEmail || undefined, action: { label: "View invoice", url } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "The email could not be confirmed. Please try again later." }, { status: 503 }); }
}
