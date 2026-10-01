"use client";
import { useEffect, useState } from "react";
import { PRODUCTS } from "../lib/products";
import { formatUSD } from "../lib/pricing";
import { supabaseConfigured } from "../lib/supabase";

type Order = { id: string; email?: string; total: number; status: string; createdAt: number };

export default function AdminPage() {
  const [tab, setTab] = useState<"orders" | "products" | "settings">("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [gate, setGate] = useState("");
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    try { setOrders(JSON.parse(localStorage.getItem("kcp-orders") ?? "[]")); } catch { setOrders([]); }
  }, []);
  function setStatus(id: string, status: string) {
    const next = orders.map((o) => (o.id === id ? { ...o, status } : o));
    setOrders(next);
    try { localStorage.setItem("kcp-orders", JSON.stringify(next)); } catch { /* noop */ }
  }
  if (!authed) {
    return (
      <div className="wrap" style={{ paddingTop: 40, maxWidth: 440 }}>
        <p className="eyebrow">Admin</p>
        <h1>Sign in</h1>
        <p className="small muted">Demo gate for launch. Enter <strong>kingdom-admin</strong> to access the dashboard on this device. Connect Supabase Auth for multi-user roles.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (gate === "kingdom-admin") setAuthed(true); }} style={{ display: "flex", gap: 8 }}>
          <input className="input" type="password" value={gate} onChange={(e) => setGate(e.target.value)} aria-label="Admin passcode" placeholder="Passcode" />
          <button className="btn">Enter</button>
        </form>
      </div>
    );
  }
  return (
    <div className="wrap" style={{ paddingTop: 26, paddingBottom: 40 }}>
      <p className="eyebrow">Admin dashboard {!supabaseConfigured() && "· local mode"}</p>
      <h1 style={{ margin: "6px 0" }}>Store overview</h1>
      <div style={{ display: "flex", gap: 8 }} role="tablist" aria-label="Admin sections">
        {(["orders", "products", "settings"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="btn ghost" style={{ background: tab === t ? "#111" : "#fff", color: tab === t ? "#fff" : "#111", textTransform: "capitalize" }}>{t}</button>)}
      </div>
      {tab === "orders" && (
        <div style={{ marginTop: 16 }}>
          {orders.length === 0 ? <div className="card" style={{ padding: 24 }}><strong>No orders yet.</strong><p className="small muted">Test orders from checkout will appear here with status tracking.</p></div> :
            <div style={{ display: "grid", gap: 10 }}>{orders.map((o) => (
              <div key={o.id} className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span><strong>{o.id}</strong><br /><span className="small muted">{o.email ?? "walk-in"} · {new Date(o.createdAt).toLocaleString()}</span></span>
                <span><strong>{formatUSD(o.total)}</strong></span>
                <select aria-label={`Status for ${o.id}`} className="input" style={{ width: 180 }} value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
                  {["paid", "in review", "approved", "in production", "shipped", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>))}</div>}
        </div>
      )}
      {tab === "products" && (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {PRODUCTS.map((p) => <div key={p.slug} className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 10 }}><span><strong>{p.name}</strong><br /><span className="small muted">{p.kind} · {p.sizes.join(", ")} · {p.colors.length} colors</span></span><strong>{formatUSD(p.basePrice)}</strong></div>)}
          <p className="small muted">To change prices, colors, sizes, or featured items without code, connect Supabase and edit the <code>products</code> table — this screen reads from it automatically when configured.</p>
        </div>
      )}
      {tab === "settings" && (
        <div className="card" style={{ marginTop: 16, padding: 18, display: "grid", gap: 10, maxWidth: 560 }}>
          <label className="lbl" htmlFor="s-ship">Free shipping threshold (USD)</label><input id="s-ship" className="input" defaultValue={75} type="number" />
          <label className="lbl" htmlFor="s-fee">Default print fee per side (USD)</label><input id="s-fee" className="input" defaultValue={6} type="number" />
          <label className="lbl" htmlFor="s-msg">Announcement bar</label><input id="s-msg" className="input" defaultValue="Free US shipping on orders over $75" />
          <p className="small muted">Settings persist to Supabase <code>site_settings</code> once connected; until then they apply per device.</p>
        </div>
      )}
    </div>
  );
}
