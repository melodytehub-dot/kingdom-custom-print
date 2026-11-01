import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, validateSession } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import type { AdminQuote } from "@/lib/admin-quotes";
import { formatUSD } from "@/lib/pricing";
import PrintInvoiceButton from "@/components/admin/PrintInvoiceButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quote or invoice", robots: { index: false, follow: false } };

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const jar = await cookies();
  if (!adminConfigured() || !(await validateSession(jar.get(ADMIN_COOKIE)?.value ?? null))) return <main className="wrap"><h1>Sign in to view this document</h1><Link href="/admin">Go to admin</Link></main>;
  const { id } = await searchParams;
  if (!id || !/^[1-9][0-9]{0,15}$/.test(id)) return <main className="wrap"><h1>Document not found</h1><Link href="/admin?tab=quotes">Back to quotes</Link></main>;
  const [quote] = await sql<AdminQuote[]>`SELECT id::text, customer_name, customer_email, notes, lines, shipping_cents, status, created_at, invoiced_at FROM admin_quotes WHERE id = ${id}::bigint`;
  if (!quote) return <main className="wrap"><h1>Document not found</h1><Link href="/admin?tab=quotes">Back to quotes</Link></main>;
  const subtotal = quote.lines.reduce((n, line) => n + line.quantity * line.unitCents, 0);
  return <main className="admin-invoice"><div className="admin-invoice-actions"><Link href="/admin?tab=quotes">Back to quotes</Link><PrintInvoiceButton /></div>
    <header className="admin-invoice-head"><div><p>Kingdom Custom Print</p><h1>{quote.status === "invoice" ? "Invoice" : "Quote"}</h1><p>#{quote.id}</p></div><div><p><strong>Date:</strong> {new Date(quote.invoiced_at ?? quote.created_at).toLocaleDateString("en-US")}</p></div></header>
    <section className="admin-invoice-customer"><h2>Prepared for</h2><p>{quote.customer_name}{quote.customer_email ? <><br />{quote.customer_email}</> : null}</p></section>
    <div className="admin-invoice-table-wrap"><table className="admin-invoice-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{quote.lines.map((line, index) => <tr key={index}><td>{line.description}</td><td>{line.quantity}</td><td>{formatUSD(line.unitCents / 100)}</td><td>{formatUSD(line.unitCents * line.quantity / 100)}</td></tr>)}</tbody></table></div>
    <dl className="admin-invoice-totals"><div><dt>Subtotal</dt><dd>{formatUSD(subtotal / 100)}</dd></div><div><dt>Shipping</dt><dd>{formatUSD(quote.shipping_cents / 100)}</dd></div><div><dt>Total</dt><dd>{formatUSD((subtotal + quote.shipping_cents) / 100)}</dd></div></dl>
    {quote.notes ? <section className="admin-invoice-customer"><h2>Notes</h2><p style={{ whiteSpace: "pre-wrap" }}>{quote.notes}</p></section> : null}
  </main>;
}
