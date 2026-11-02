import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, validateSession } from "@/lib/admin-auth";
import { getAdminOrder } from "@/lib/orders";
import { getSettings } from "@/lib/catalog";
import { formatUSD } from "@/lib/pricing";
import { ORDER_STATUSES } from "@/lib/types";
import PrintInvoiceButton from "@/components/admin/PrintInvoiceButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order invoice", robots: { index: false, follow: false } };

export default async function InvoicePage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const jar = await cookies();
  if (!adminConfigured() || !(await validateSession(jar.get(ADMIN_COOKIE)?.value ?? null))) {
    return <main className="wrap"><h1>Sign in to view this order</h1><Link href="/admin">Go to admin</Link></main>;
  }
  const { ref } = await searchParams;
  const order = ref ? await getAdminOrder(ref) : null;
  if (!order) return <main className="wrap"><h1>Order not found</h1><Link href="/admin?tab=orders">Back to orders</Link></main>;
  const settings = await getSettings();
  const status = ORDER_STATUSES.find((entry) => entry.value === order.status)?.label ?? order.status;
  const adjustments = Math.round((order.subtotal - order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)) * 100) / 100;
  return <main className="admin-invoice">
    <div className="admin-invoice-actions"><Link href="/admin?tab=orders">Back to orders</Link><PrintInvoiceButton /></div>
    <header className="admin-invoice-head"><div><p>Kingdom Custom Print</p>{settings.businessAddress ? <p>{settings.businessAddress}</p> : null}{settings.contactEmail ? <p>{settings.contactEmail}</p> : null}{settings.contactPhone ? <p>{settings.contactPhone}</p> : null}<h1>Order invoice</h1><p>Order {order.reference}</p></div><div><p><strong>Order date:</strong> {new Date(order.createdAt).toLocaleDateString("en-US")}</p><p><strong>Status:</strong> {status}</p>{order.paidAt ? <p><strong>Paid:</strong> {new Date(order.paidAt).toLocaleDateString("en-US")}</p> : null}</div></header>
    <section className="admin-invoice-customer"><h2>Customer</h2><p>{order.name}<br />{order.email}{order.phone ? <><br />{order.phone}</> : null}</p><h2>Delivery address</h2><address>{order.addressLine1}{order.addressLine2 ? <><br />{order.addressLine2}</> : null}<br />{order.city}, {order.region} {order.postal}<br />{order.country}</address></section>
    <div className="admin-invoice-table-wrap"><table className="admin-invoice-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={index}><td><strong>{item.productName}</strong><br /><span>{item.colorName} · {item.sizeBreakdown.filter((size) => size.qty > 0).map((size) => `${size.label} × ${size.qty}`).join(", ")}</span></td><td>{item.quantity}</td><td>{formatUSD(item.unitPrice)}</td><td>{formatUSD(item.unitPrice * item.quantity)}</td></tr>)}</tbody></table></div>
    <dl className="admin-invoice-totals">{adjustments !== 0 ? <div><dt>Item adjustments</dt><dd>{formatUSD(adjustments)}</dd></div> : null}<div><dt>Subtotal</dt><dd>{formatUSD(order.subtotal)}</dd></div><div><dt>Shipping</dt><dd>{formatUSD(order.shipping)}</dd></div><div><dt>Total</dt><dd>{formatUSD(order.total)}</dd></div></dl>
  </main>;
}
