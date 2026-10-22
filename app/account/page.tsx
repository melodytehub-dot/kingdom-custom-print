import Link from "next/link";
import { AccountAccess, AccountSignOut } from "@/components/AccountAccess";
import { customerFromCookies } from "@/lib/customer-auth";
import { sql, num } from "@/lib/db";
import { formatUSD } from "@/lib/pricing";
import "./account.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account", robots: { index: false, follow: false } };

type AccountOrder = { reference: string; status: string; total: unknown; created_at: Date };

export default async function AccountPage() {
  const account = await customerFromCookies();
  const orders = account ? await sql<AccountOrder[]>`
    SELECT reference, status, total, created_at FROM orders
    WHERE account_id = ${account.id} ORDER BY created_at DESC LIMIT 30` : [];

  return (
    <section className="account-page minimog-container">
      <header className="account-heading">
        <div><span className="mm-hero-tag">KINGDOM CUSTOM PRINT</span><h1>{account ? "Your account" : "Welcome back"}</h1></div>
        {account ? <AccountSignOut /> : null}
      </header>
      {account ? (
        <div className="account-content">
          <div className="account-profile"><h2>{account.name}</h2><p>{account.email}</p><Link href="/shop">Continue shopping</Link></div>
          <div className="account-orders">
            <h2>Orders</h2>
            {orders.length ? <ul>{orders.map((order) => <li key={order.reference}>
              <Link href={`/order/${order.reference}`}>
                <span><strong>{order.reference}</strong><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(order.created_at))}</small></span>
                <span><strong>{formatUSD(num(order.total))}</strong><small>{order.status.replaceAll("_", " ")}</small></span>
              </Link>
            </li>)}</ul> : <div className="account-empty"><p>Orders you place while signed in will appear here.</p><Link href="/shop">Shop products</Link></div>}
          </div>
        </div>
      ) : <AccountAccess />}
    </section>
  );
}
