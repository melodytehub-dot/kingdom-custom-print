"use client";
import { InlineSkeleton } from "@/components/PageSkeleton";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";

type Count = { color_name: string; size_label: string; quantity: number; reserved: number };
type Adjustment = { color_name: string; size_label: string; previous_quantity: number | null; new_quantity: number; created_at: string };
const keyFor = (color: string, size: string) => JSON.stringify([color, size]);

export default function InventoryPanel({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Adjustment[]>([]);
  const [reserved, setReserved] = useState<Record<string, number>>({});
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(Boolean(products.length));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const product = products.find((item) => item.id === productId);
  const activeColor = product?.colors.find((color) => color.name === selectedColor) ?? product?.colors[0];
  const dirty = Object.entries(values).some(([key, value]) => value !== (baseline[key] === undefined ? "" : String(baseline[key])));

  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    fetch(`/api/admin/inventory?product=${productId}`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error); return data as { counts: Count[]; history: Adjustment[]; enabled: boolean }; })
      .then(({ counts: rows, history: changes, enabled: protection }) => {
        const next: Record<string, number> = {};
        for (const row of rows) next[keyFor(row.color_name, row.size_label)] = row.quantity;
        setBaseline(next); setReserved(Object.fromEntries(rows.map((row) => [keyFor(row.color_name, row.size_label), row.reserved]))); setEnabled(protection); setHistory(changes); setValues(Object.fromEntries(Object.entries(next).map(([key, value]) => [key, String(value)]))); setLoading(false);
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) { setMessage(error instanceof Error ? error.message : "Could not load inventory."); setLoading(false); } });
    return () => controller.abort();
  }, [productId, reload]);

  function choose(value: string) {
    if (dirty && !window.confirm("Discard your unsaved stock count changes?")) return;
    setLoading(true); setBaseline({}); setReserved({}); setHistory([]); setValues({}); setMessage(""); setSelectedColor(""); setProductId(Number(value));
  }
  async function toggleProtection() {
    if (dirty) { setMessage("Save or discard the current stock changes before changing protection."); return; }
    const prompt = enabled ? "Turn off stock protection? Customers can order beyond the recorded counts." : "Enable stock protection? All active product options need a reviewed count, and items without available stock cannot be ordered.";
    if (!window.confirm(prompt)) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/inventory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !enabled }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage(enabled ? "Stock protection is off." : "Stock protection is on."); setLoading(true); setReload((n) => n + 1);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not change stock protection."); }
    finally { setSaving(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!product) return;
    const counts: { color: string; size: string; quantity: number; expected: number | null }[] = [];
    for (const color of product.colors) for (const size of product.sizes) {
      const key = keyFor(color.name, size.label), raw = values[key];
      if (raw === undefined || raw === "") {
        if (baseline[key] !== undefined) { setMessage(`Enter a count for ${color.name}, ${size.label}.`); setSelectedColor(color.name); return; }
        continue;
      }
      const quantity = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(quantity) || quantity > 1000000 || quantity < (reserved[key] ?? 0)) { setMessage(`Check ${color.name}, ${size.label}: enter a whole number from ${reserved[key] ?? 0} to 1,000,000.`); setSelectedColor(color.name); return; }
      const expected = baseline[key] ?? null;
      if (expected !== quantity) counts.push({ color: color.name, size: size.label, quantity, expected });
    }
    if (!counts.length) { setMessage("There are no changes to save."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/inventory", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, counts }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage("Stock counts saved."); setLoading(true); setReload((n) => n + 1);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save counts."); }
    finally { setSaving(false); }
  }

  return <section aria-label="Inventory"><div className="admin-block-head"><div><h2 className="h3">Inventory</h2><p className="small muted">Record how many items you have in each color and size.</p></div></div>
    <div className="banner-note"><p>{enabled ? "Stock protection is on. Pending checkouts hold stock, and confirmed payments update counts." : "Finished products always require stock. Protection for customizable products is off."}</p><button type="button" className="btn btn-light btn-sm" disabled={saving || loading || !products.length} onClick={() => void toggleProtection()}>{enabled ? "Turn off stock protection" : "Enable stock protection"}</button></div>
    {message ? <p className="banner-note" role="status">{message}</p> : null}
    <PaymentHolds disabled={dirty} onChanged={() => { setLoading(true); setReload((n) => n + 1); }} />
    {!products.length ? <p>No products yet.</p> : <><label className="field admin-inventory-product">Product<select className="select" value={productId} disabled={saving} onChange={(event) => choose(event.target.value)}>{products.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : " (hidden)"}</option>)}</select></label>
      {loading ? <InlineSkeleton label="Loading stock counts" /> : product ? <><form onSubmit={save}><p className="hint">Enter the total you have on hand. Leave uncounted options blank; enter 0 for out of stock. Held stock is part of the total.</p><label className="field admin-inventory-product">Color<select className="select" value={activeColor?.name ?? ""} disabled={saving} onChange={(event) => setSelectedColor(event.target.value)}>{product.colors.map((color) => <option key={color.id} value={color.name}>{color.name}</option>)}</select></label>{activeColor ? [activeColor].map((color) => <fieldset className="admin-inventory-color" key={color.id}><legend><span className="admin-inventory-swatch" style={{ backgroundColor: color.hex }} aria-hidden="true" />{color.name}</legend><div className="admin-inventory-grid">{product.sizes.map((size) => { const key = keyFor(color.name, size.label); return <label className="field" key={key}>{size.label}<input className="input" type="number" min={reserved[key] ?? 0} max="1000000" step="1" inputMode="numeric" required={baseline[key] !== undefined} disabled={saving} value={values[key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} aria-label={`${color.name}, ${size.label} stock`} />{reserved[key] ? <span className="hint">{reserved[key]} held</span> : null}</label>; })}</div></fieldset>) : <p>No colors are available for this product.</p>}<button type="submit" className="btn" disabled={saving}>{saving ? "Saving…" : "Save counts"}</button></form><div className="admin-inventory-history"><h3 className="h3">Recent changes</h3>{history.length ? <ul>{history.map((entry, index) => <li key={index}>{entry.color_name} · {entry.size_label}: {entry.previous_quantity === null ? "not counted" : entry.previous_quantity} → {entry.new_quantity} <span className="muted">({new Date(entry.created_at).toLocaleString()})</span></li>)}</ul> : <p className="muted">No counts have been recorded for this product yet.</p>}</div></> : null}</>}
  </section>;
}

type HeldOrder = { reference: string; status: string; created_at: string; provider: string };
function PaymentHolds({ onChanged, disabled }: { onChanged: () => void; disabled: boolean }) {
  const [orders, setOrders] = useState<HeldOrder[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [checking, setChecking] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/inventory/reconcile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setOrders(data.orders); setFailed(false); })
      .catch((error: unknown) => { if (!controller.signal.aborted) { setFailed(true); setMessage(error instanceof Error ? error.message : "Could not load payment holds."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  async function check(reference: string) {
    setChecking(reference); setMessage("");
    try {
      const response = await fetch("/api/admin/inventory/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setMessage(`${reference}: the payment provider confirmed checkout is closed.`); setRefresh((n) => n + 1); onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not check the payment."); }
    finally { setChecking(""); }
  }
  return <div className="admin-inventory-history"><h3 className="h3">Payment holds</h3><p className="hint">Pending payments keep stock reserved. A hold is released only after the payment provider confirms checkout is closed.</p>{message ? <p role="status" className="banner-note">{message}</p> : null}{loading ? <InlineSkeleton label="Loading payment holds" rows={2} /> : failed ? null : orders.length ? <ul>{orders.map((order) => <li key={order.reference}><strong>{order.reference}</strong> · {order.provider === "stripe" ? "Card" : order.provider === "paypal" ? "PayPal" : "Payment"} · {new Date(order.created_at).toLocaleDateString()} <button className="link" type="button" disabled={disabled || Boolean(checking)} onClick={() => void check(order.reference)}>{checking === order.reference ? "Checking…" : "Check payment"}</button></li>)}</ul> : <p className="muted">No payment holds need attention.</p>}</div>;
}

