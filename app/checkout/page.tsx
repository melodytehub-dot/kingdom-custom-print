"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "../lib/store";
import { formatUSD } from "../lib/pricing";

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useStore();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) { setError("Enter a valid email for your receipt."); return; }
    if (!name.trim() || !address.trim()) { setError("Add your name and shipping address."); return; }
    if (!cart.length) { setError("Your cart is empty."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, name, address, items: cart }) });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      if (data.orderId) {
        try {
          const orders = JSON.parse(localStorage.getItem("kcp-orders") ?? "[]");
          orders.push({ id: data.orderId, email, name, address, items: cart, total: cartTotal, status: "paid", createdAt: Date.now() });
          localStorage.setItem("kcp-orders", JSON.stringify(orders));
        } catch { /* noop */ }
        clearCart();
        router.push(`/order/success?id=${data.orderId}`);
        return;
      }
      setError("Checkout could not start. Please try again.");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally { setLoading(false); }
  }

  return (
    <div className="wrap" style={{ paddingTop: 26, paddingBottom: 30, display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
      <form onSubmit={submit} noValidate>
        <h1 style={{ margin: "0 0 8px" }}>Checkout</h1>
        {error && <p role="alert" style={{ background: "#fdecec", border: "1px solid #e8a0a0", padding: "10px 12px", borderRadius: 6 }}>{error}</p>}
        <label className="lbl" htmlFor="co-email">Email</label>
        <input id="co-email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <div style={{ height: 12 }} />
        <label className="lbl" htmlFor="co-name">Full name</label>
        <input id="co-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Smith" />
        <div style={{ height: 12 }} />
        <label className="lbl" htmlFor="co-addr">Shipping address</label>
        <textarea id="co-addr" className="input" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state, ZIP" />
        <button className="btn" style={{ marginTop: 16 }} disabled={loading || !cart.length}>{loading ? "Starting secure checkout…" : `Pay ${formatUSD(cartTotal)} securely`}</button>
        <p className="small muted">Powered by Stripe in live mode. Test mode is used until store keys are connected.</p>
      </form>
      <aside className="card" style={{ padding: 16, alignSelf: "start" }}>
        <h3 style={{ margin: "0 0 8px" }}>Order summary</h3>
        {cart.length === 0 ? <p className="small muted">Nothing here yet. <Link href="/shop" style={{ textDecoration: "underline" }}>Browse products</Link></p> :
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>{cart.map((i) => <li key={i.key} style={{ fontSize: 14, display: "flex", justifyContent: "space-between", gap: 8 }}><span>{i.productName} × {i.count}</span><strong>{formatUSD(i.total)}</strong></li>)}</ul>}
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}><span>Total</span><strong>{formatUSD(cartTotal)}</strong></div>
      </aside>
      <style>{`@media(max-width:900px){div.wrap[style*="1fr 360px"]{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
