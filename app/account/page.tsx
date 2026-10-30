import Link from "next/link";
import { AccountAccess, AccountSignOut } from "@/components/AccountAccess";
import { customerFromCookies } from "@/lib/customer-auth";
import { sql, num } from "@/lib/db";
import { formatUSD } from "@/lib/pricing";
import { getProducts } from "@/lib/catalog";
import AccountSavedItems from "@/components/AccountSavedItems";
import "./account.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your account", robots: { index: false, follow: false } };

type AccountOrder = { reference: string; status: string; total: unknown; created_at: Date };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ google?: string; verification?: string }> }) {
  const params = await searchParams;
  const account = await customerFromCookies();
  const orders = account ? await sql<AccountOrder[]>`
    SELECT reference, status, total, created_at FROM orders
    WHERE account_id = ${account.id} ORDER BY created_at DESC LIMIT 30` : [];
  const products = account ? await getProducts() : [];

  return (
    <section className="account-page minimog-container">
      <header className="account-heading">
        <div><h1>{account ? "Your account" : "Welcome back"}</h1></div>
        {account ? <AccountSignOut /> : null}
      </header>
      {params.verification ? <p role="status">{params.verification === "success" ? "Email confirmed. You can sign in now." : params.verification === "invalid" ? "This confirmation link is invalid or expired. Sign in to receive a new link." : "We could not confirm your email. Please try again."}</p> : null}
      {account ? (
        <div className="account-content">
          <div className="account-profile"><h2>{account.name}</h2><p>{account.email}</p><nav aria-label="Account sections"><a href="#orders">Orders</a><a href="#wishlist">Wishlist</a><a href="#designs">Saved designs</a><Link href="/cart">Your cart</Link><Link href="/shop">Continue shopping</Link></nav></div>
          <div>
          <section className="account-orders" id="orders">
            <h2>Orders</h2>
            {orders.length ? <ul>{orders.map((order) => <li key={order.reference}>
              <Link href={`/order/${order.reference}`}>
                <span><strong>{order.reference}</strong><small>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(order.created_at))}</small></span>
                <span><strong>{formatUSD(num(order.total))}</strong></span>
              </Link>
            </li>)}</ul> : <div className="account-empty"><p>Orders you place while signed in will appear here.</p><Link href="/shop">Shop products</Link></div>}
          </section>
          <AccountSavedItems products={products} />
          </div>
        </div>
      ) : <AccountAccess googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} googleError={params.google === "cancelled" ? "Google sign-in was cancelled." : params.google === "account-exists" ? "This email already has an account. Sign in with its password first." : params.google ? "Google sign-in could not be completed. Please try again." : ""} />}
    </section>
  );
}
