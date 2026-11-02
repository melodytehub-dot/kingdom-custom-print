import { createHash } from "node:crypto";
import Link from "next/link";
import { sql } from "@/lib/db";
import { getSettings } from "@/lib/catalog";
import type { AdminQuote } from "@/lib/admin-quotes";
import { formatUSD } from "@/lib/pricing";
import PrintInvoiceButton from "@/components/admin/PrintInvoiceButton";
import InvoicePayment from "@/components/InvoicePayment";
import { paymentsConfigured } from "@/lib/stripe";
import { paypalConfigured } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your invoice", robots: { index: false, follow: false } };

export default async function SharedInvoice({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return <Unavailable />;
  const hash = createHash("sha256").update(token).digest("hex");
  const [invoice] = await sql<AdminQuote[]>`SELECT q.id::text, q.customer_name, q.customer_email, q.notes, q.lines, q.shipping_cents, q.status, q.created_at, q.invoiced_at FROM invoice_share_tokens t JOIN admin_quotes q ON q.id = t.quote_id WHERE t.token_hash = ${hash} AND t.expires_at > now() AND q.status = 'invoice'`;
  if (!invoice) return <Unavailable />;
  const settings = await getSettings();
  const [payment] = await sql<{ state: string }[]>`SELECT state FROM invoice_payment_attempts WHERE quote_id = ${invoice.id}::bigint AND state IN ('creating', 'open', 'paid', 'refunded') LIMIT 1`;
  const query = await searchParams;
  const [stripe, paypal] = await Promise.all([paymentsConfigured().catch(() => false), paypalConfigured().catch(() => false)]);
  const subtotal = invoice.lines.reduce((sum, line) => sum + line.quantity * line.unitCents, 0);
  return <main className="admin-invoice public-invoice"><div className="admin-invoice-actions"><Link href="/contact">Contact us</Link><PrintInvoiceButton /></div>
    <header className="admin-invoice-head"><div><p>Kingdom Custom Print</p>{settings.businessAddress ? <p>{settings.businessAddress}</p> : null}{settings.contactEmail ? <p>{settings.contactEmail}</p> : null}{settings.contactPhone ? <p>{settings.contactPhone}</p> : null}<h1>Invoice</h1><p>#{invoice.id}</p></div><div><p><strong>Date:</strong> {new Date(invoice.invoiced_at ?? invoice.created_at).toLocaleDateString("en-US")}</p></div></header>
    <section className="admin-invoice-customer"><h2>Prepared for</h2><p>{invoice.customer_name}{invoice.customer_email ? <><br />{invoice.customer_email}</> : null}</p></section>
    <div className="admin-invoice-table-wrap"><table className="admin-invoice-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{invoice.lines.map((line, index) => <tr key={index}><td>{line.description}</td><td>{line.quantity}</td><td>{formatUSD(line.unitCents / 100)}</td><td>{formatUSD(line.unitCents * line.quantity / 100)}</td></tr>)}</tbody></table></div>
    <dl className="admin-invoice-totals"><div><dt>Subtotal</dt><dd>{formatUSD(subtotal / 100)}</dd></div><div><dt>Shipping</dt><dd>{formatUSD(invoice.shipping_cents / 100)}</dd></div><div><dt>Total</dt><dd>{formatUSD((subtotal + invoice.shipping_cents) / 100)}</dd></div></dl>
    {invoice.notes ? <section className="admin-invoice-customer"><h2>Notes</h2><p style={{ whiteSpace: "pre-wrap" }}>{invoice.notes}</p></section> : null}
    {payment?.state === "paid" ? <section className="admin-invoice-customer"><h2>Payment received</h2><p>Thank you for your payment.</p></section> : payment?.state === "refunded" ? <section className="admin-invoice-customer"><h2>Payment refunded</h2><p>Please contact us if you have questions.</p></section> : <>{query.payment ? <p role="status">If you completed payment, it may take a moment to appear. Refresh this page to check.</p> : null}<InvoicePayment token={token} stripe={stripe} paypal={paypal} /></>}
  </main>;
}

function Unavailable() {
  return <main className="admin-invoice"><h1>Invoice link unavailable</h1><p>This link may have expired. Please contact us for a new one.</p><Link href="/contact" className="btn">Contact us</Link></main>;
}
