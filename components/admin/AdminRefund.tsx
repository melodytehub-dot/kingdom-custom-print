"use client";

import { useState } from "react";
import { formatUSD } from "@/lib/pricing";

export default function AdminRefund({ reference, total, provider }: { reference: string; total: number; provider: "stripe" | "paypal" }) {
  const gateway = provider === "stripe" ? "Stripe" : "PayPal";
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Refund the ${gateway} payment for order ${reference} (up to ${formatUSD(total)}) to the original payment method?`)) return;
    setPending(true); setNotice("");
    try {
      const response = await fetch("/api/admin/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, password }) });
      const body = await response.json();
      setPassword("");
      if (!response.ok) { setNotice(body.error || "The refund could not be submitted."); return; }
      setNotice(body.message); setOpen(false);
    } catch { setNotice(`Connection error. Check ${gateway} before trying again.`); } finally { setPending(false); }
  }
  return <div className="admin-subsection">
    <h4 className="panel-heading">Refund payment</h4>
    <p className="hint">Return the remaining {gateway} payment to the original payment method. The order is marked refunded when {gateway} confirms it.</p>
    {!open ? <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen(true)}>Refund order</button> :
      <form method="post" action="/api/admin/refund" onSubmit={submit} className="settings-form"><label className="label" htmlFor="refund-password">Confirm admin password</label><input id="refund-password" className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /><div className="form-actions"><button className="btn btn-sm" type="submit" disabled={pending}>{pending ? "Submitting…" : "Confirm refund"}</button><button className="btn btn-light btn-sm" type="button" disabled={pending} onClick={() => { setOpen(false); setPassword(""); }}>Cancel</button></div></form>}
    {notice ? <p className="hint" role="status">{notice}</p> : null}
  </div>;
}
