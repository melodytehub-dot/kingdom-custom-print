"use client";
import { useState } from "react";

export default function InvoiceRefund({ id }: { id: string }) {
  const [open, setOpen] = useState(false), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Refund invoice #${id} to the original payment method?`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/invoice-refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password }) });
      const body = await response.json() as { error?: string; message?: string };
      setPassword(""); if (!response.ok) throw new Error(body.error || "Could not submit the refund.");
      setOpen(false); setMessage(body.message || "Refund submitted.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit the refund."); }
    finally { setBusy(false); }
  }
  return <div>{!open ? <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen(true)}>Refund invoice</button> : <form onSubmit={submit} className="settings-form"><label className="field">Confirm admin password<input className="input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><div className="form-actions"><button className="btn btn-sm" disabled={busy}>{busy ? "Submitting…" : "Confirm refund"}</button><button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => { setOpen(false); setPassword(""); }}>Cancel</button></div></form>}{message ? <p role="status">{message}</p> : null}</div>;
}
