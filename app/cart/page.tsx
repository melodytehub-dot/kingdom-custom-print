"use client";
import Link from "next/link";
import { useStore } from "../lib/store";
import { formatUSD } from "../lib/pricing";

export default function CartPage() {
  const { cart, updateQty, removeFromCart, cartTotal, cartCount } = useStore();
  if (!cart.length) {
    return (
      <div className="wrap" style={{ paddingTop: 40, paddingBottom: 40, textAlign: "center" }}>
        <h1>Your cart is empty</h1>
        <p className="muted">Design something custom or pick up a blank.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
          <Link href="/customize" className="btn">Open studio</Link>
          <Link href="/shop" className="btn ghost">Shop blanks</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="wrap" style={{ paddingTop: 26, paddingBottom: 30 }}>
      <h1 style={{ margin: "0 0 4px" }}>Cart ({cartCount})</h1>
      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {cart.map((it) => (
          <article key={it.key} className="card" style={{ padding: 16, display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 14, alignItems: "center" }}>
            <div style={{ background: it.colorHex, borderRadius: 6, minHeight: 110, border: "1px solid var(--line)" }} aria-hidden />
            <div>
              <strong>{it.productName}</strong>
              <p className="small muted" style={{ margin: "4px 0" }}>{it.colorName} · {it.sides.front.length + it.sides.back.length} design layer(s){it.previewFront ? " · preview attached" : ""}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {it.lines.map((l) => (
                  <span key={l.size} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--line)", borderRadius: 6, padding: "4px 8px", fontSize: 13 }}>
                    {l.size} × <input aria-label={`Quantity for size ${l.size}`} type="number" min={0} max={999} value={l.qty} onChange={(e) => updateQty(it.key, l.size, Number(e.target.value) || 0)} style={{ width: 52, border: "1px solid var(--line)", borderRadius: 4, padding: "3px 6px" }} />
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <strong>{formatUSD(it.total)}</strong>
              <div><button onClick={() => removeFromCart(it.key)} style={{ background: "none", border: 0, textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>Remove</button></div>
            </div>
          </article>
        ))}
      </div>
      <div className="card" style={{ padding: 16, marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span className="muted small">Shipping calculated at checkout · Free US shipping over $75</span>
        <strong style={{ fontSize: 20 }}>Subtotal {formatUSD(cartTotal)}</strong>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
        <Link href="/shop" className="btn ghost">Continue shopping</Link>
        <Link href="/checkout" className="btn">Checkout</Link>
      </div>
    </div>
  );
}
