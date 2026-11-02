"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminQuote } from "@/lib/admin-quotes";
import { formatUSD } from "@/lib/pricing";
import InvoiceRefund from "./InvoiceRefund";

type Line = { description: string; quantity: string; price: string };
const blank = () => ({ description: "", quantity: "1", price: "" });

export default function QuotesPanel() {
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [notes, setNotes] = useState("");
  const [shipping, setShipping] = useState("0.00"); const [lines, setLines] = useState<Line[]>([blank()]);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState("");
  const load = useCallback(async () => {
    try { const res = await fetch("/api/admin/quotes", { cache: "no-store" }); const body = await res.json(); if (!res.ok) throw new Error(body.error); setQuotes(body.quotes); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Could not load quotes."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/quotes", { cache: "no-store", signal: controller.signal })
      .then(async (res) => { const body = await res.json(); if (!res.ok) throw new Error(body.error); setQuotes(body.quotes); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Could not load quotes."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  function start(quote?: AdminQuote) {
    setEditing(quote?.id ?? null); setName(quote?.customer_name ?? ""); setEmail(quote?.customer_email ?? ""); setNotes(quote?.notes ?? "");
    setShipping(quote ? (quote.shipping_cents / 100).toFixed(2) : "0.00");
    setLines(quote ? quote.lines.map((l) => ({ description: l.description, quantity: String(l.quantity), price: (l.unitCents / 100).toFixed(2) })) : [blank()]);
    setMessage(""); setOpen(true);
  }
  function cents(value: string) { return /^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim()) ? Math.round(Number(value) * 100) : NaN; }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMessage("");
    const payload = { id: editing, name, email, notes, shippingCents: cents(shipping), lines: lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitCents: cents(l.price) })) };
    try { const res = await fetch("/api/admin/quotes", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await res.json(); if (!res.ok) throw new Error(body.error); setOpen(false); setMessage("Quote saved."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the quote."); }
    finally { setSaving(false); }
  }
  async function convert(id: string) {
    if (!window.confirm("Convert this quote to an invoice? The invoice will be locked against editing.")) return;
    setSaving(true); setMessage("");
    try { const res = await fetch("/api/admin/quotes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "invoice" }) }); const body = await res.json(); if (!res.ok) throw new Error(body.error); setMessage("Invoice created. Open it to print or save as a PDF."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not create the invoice."); }
    finally { setSaving(false); }
  }
  async function sendDocument(quote: AdminQuote) {
    const type = quote.status === "quote" ? "quote" : "invoice";
    if (!quote.customer_email || !window.confirm(`Send ${type} #${quote.id} to ${quote.customer_email}?`)) return;
    setSending(quote.id); setMessage("");
    try {
      const response = await fetch(type === "quote" ? "/api/admin/quotes/send-quote" : "/api/admin/quotes/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: quote.id }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setMessage(`${type === "quote" ? "Quote" : "Invoice"} #${quote.id} was submitted for delivery to ${quote.customer_email}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : `Could not send the ${type}.`); }
    finally { setSending(""); }
  }
  return <section aria-label="Quotes and invoices"><div className="admin-block-head"><div><h2 className="h3">Quotes & invoices</h2><p className="small muted">Create a quote, then turn it into a printable invoice when it is ready.</p></div><button className="btn btn-sm" type="button" onClick={() => start()}>New quote</button></div>
    {message ? <p className="banner-note" role="status">{message}</p> : null}
    {open ? <form className="product-form" onSubmit={save}><h3 className="h3">{editing ? "Edit quote" : "New quote"}</h3><div className="field-grid"><label className="field">Customer name<input className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label><label className="field">Email (optional)<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label></div>
      <h4 className="panel-heading">Items</h4>{lines.map((line, index) => <div className="admin-quote-line" key={index}><label className="field">Description<input className="input" required maxLength={200} value={line.description} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, description: e.target.value } : l))} /></label><label className="field">Quantity<input className="input" type="number" required min="1" max="10000" step="1" value={line.quantity} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, quantity: e.target.value } : l))} /></label><label className="field">Price each ($)<input className="input" type="number" required min="0" max="100000" step="0.01" value={line.price} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, price: e.target.value } : l))} /></label>{lines.length > 1 ? <button className="link" type="button" onClick={() => setLines(lines.filter((_, i) => i !== index))}>Remove item {index + 1}</button> : null}</div>)}
      <button className="btn btn-light btn-sm" type="button" disabled={lines.length >= 50} onClick={() => setLines([...lines, blank()])}>Add item</button><div className="field-grid"><label className="field">Shipping ($)<input className="input" type="number" min="0" max="100000" step="0.01" required value={shipping} onChange={(e) => setShipping(e.target.value)} /></label><label className="field">Notes (optional)<textarea className="input" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></label></div><div className="form-actions"><button className="btn" disabled={saving}>Save quote</button><button className="btn btn-light" type="button" onClick={() => setOpen(false)}>Cancel</button></div></form> : null}
    {loading ? <p>Loading quotes…</p> : !quotes.length ? <p className="muted">No quotes yet. Create one to get started.</p> : <div className="admin-quote-list">{quotes.map((q) => <article className="admin-quote-card" key={q.id}><div><strong>{q.customer_name}</strong><p className="small muted">{q.status === "invoice" ? "Invoice" : "Quote"} #{q.id} · {formatUSD((q.lines.reduce((n, l) => n + l.quantity * l.unitCents, 0) + q.shipping_cents) / 100)}{q.status === "invoice" ? ` · ${q.payment_state === "paid" ? "Paid" : q.payment_state === "refunded" ? "Refunded" : q.payment_state === "open" || q.payment_state === "creating" ? "Payment in progress" : "Unpaid"}` : ""}</p></div><div className="admin-quote-actions"><a className="link" href={`/admin/quote?id=${q.id}`} target="_blank" rel="noopener noreferrer">View / print</a>{q.status === "quote" ? <><button className="link" type="button" onClick={() => start(q)}>Edit</button><button className="btn btn-light btn-sm" disabled={saving} type="button" onClick={() => void convert(q.id)}>Create invoice</button></> : null}<button className="btn btn-light btn-sm" disabled={Boolean(sending) || !q.customer_email} type="button" onClick={() => void sendDocument(q)}>{sending === q.id ? "Sending…" : q.status === "quote" ? "Email quote" : "Email invoice"}</button>{q.payment_state === "paid" ? <InvoiceRefund id={q.id} /> : null}</div></article>)}</div>}
    <p className="hint">Add a customer email to send quotes and invoices.</p>
  </section>;
}
