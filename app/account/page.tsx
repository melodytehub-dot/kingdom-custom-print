"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUSD } from "../lib/pricing";

export default function AccountPage() {
  const [orders, setOrders] = useState<{ id: string; total: number; createdAt: number; status: string }[]>([]);
  useEffect(() => {
    try { setOrders(JSON.parse(localStorage.getItem("kcp-orders") ?? "[]")); } catch { setOrders([]); }
  }, []);
  return (
    <div className="wrap" style={{ paddingTop: 26, paddingBottom: 30 }}>
      <p className="eyebrow">Account</p>
      <h1 style={{ margin: "6px 0" }}>Orders</h1>
      {orders.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          <p><strong>No orders yet on this device.</strong></p>
          <p className="muted small">Orders placed here will appear in this list. Sign-in syncs across devices once Supabase keys are connected.</p>
          <Link href="/shop" className="btn" style={{ marginTop: 10 }}>Start shopping</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>{orders.map((o) => <div key={o.id} className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between" }}><span><strong>{o.id}</strong><br /><span className="small muted">{new Date(o.createdAt).toLocaleString()} · {o.status}</span></span><strong>{formatUSD(o.total)}</strong></div>)}</div>
      )}
    </div>
  );
}
