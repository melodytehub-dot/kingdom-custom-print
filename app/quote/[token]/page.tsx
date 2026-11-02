import { createHash } from "node:crypto";
import Link from "next/link";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/catalog";
import type { AdminQuote } from "@/lib/admin-quotes";
import { formatUSD } from "@/lib/pricing";
import PrintInvoiceButton from "@/components/admin/PrintInvoiceButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your quote", robots: { index: false, follow: false } };

export default async function SharedQuote({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return <Unavailable />;
  const hash = createHash("sha256").update(token).digest("hex");
  const [row] = await sql<{ snapshot: AdminQuote }[]>`SELECT snapshot FROM quote_share_tokens WHERE token_hash = ${hash} AND expires_at > now()`;
  if (!row) return <Unavailable />;
  const quote = row.snapshot;
  const settings = await getSettings();
  const subtotal = quote.lines.reduce((sum, line) => sum + line.quantity * line.unitCents, 0);
  return <main className="admin-invoice public-invoice"><div className="admin-invoice-actions"><Link href="/contact">Contact us</Link><PrintInvoiceButton /></div>
    <header className="admin-invoice-head"><div><p>Kingdom Custom Print</p>{settings.businessAddress ? <p>{settings.businessAddress}</p> : null}{settings.contactEmail ? <p>{settings.contactEmail}</p> : null}{settings.contactPhone ? <p>{settings.contactPhone}</p> : null}<h1>Quote</h1><p>#{quote.id}</p></div><div><p><strong>Date:</strong> {new Date(quote.created_at).toLocaleDateString("en-US")}</p></div></header>
    <section className="admin-invoice-customer"><h2>Prepared for</h2><p>{quote.customer_name}{quote.customer_email ? <><br />{quote.customer_email}</> : null}</p></section>
    <div className="admin-invoice-table-wrap"><table className="admin-invoice-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{quote.lines.map((line, index) => <tr key={index}><td>{line.description}</td><td>{line.quantity}</td><td>{formatUSD(line.unitCents / 100)}</td><td>{formatUSD(line.unitCents * line.quantity / 100)}</td></tr>)}</tbody></table></div>
    <dl className="admin-invoice-totals"><div><dt>Subtotal</dt><dd>{formatUSD(subtotal / 100)}</dd></div><div><dt>Shipping</dt><dd>{formatUSD(quote.shipping_cents / 100)}</dd></div><div><dt>Total</dt><dd>{formatUSD((subtotal + quote.shipping_cents) / 100)}</dd></div></dl>
    {quote.notes ? <section className="admin-invoice-customer"><h2>Notes</h2><p style={{ whiteSpace: "pre-wrap" }}>{quote.notes}</p></section> : null}
  </main>;
}

function Unavailable() {
  return <main className="admin-invoice"><h1>Quote link unavailable</h1><p>This link may have expired. Please contact us for a new one.</p><Link href="/contact" className="btn">Contact us</Link></main>;
}
