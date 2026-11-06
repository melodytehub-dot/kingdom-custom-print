"use client";
import { InlineSkeleton } from "@/components/PageSkeleton";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import ProductPhotography from "@/components/ProductPhotography";

type Count = { color_name: string; size_label: string; quantity: number; reserved: number };
type Adjustment = { color_name: string; size_label: string; previous_quantity: number | null; new_quantity: number; created_at: string };
const keyFor = (color: string, size: string) => JSON.stringify([color, size]);

export default function InventoryPanel({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState(0);
  const [baseline, setBaseline] = useState<Record<string, number>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Adjustment[]>([]);
  const [reserved, setReserved] = useState<Record<string, number>>({});
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [search, setSearch] = useState("");
  const [fillCount, setFillCount] = useState("");
  const [summary, setSummary] = useState<{id:number;total:number;counted:number}[]>([]);
  const product = products.find((item) => item.id === productId);
  const activeColor = product?.colors.find((color) => color.name === selectedColor) ?? product?.colors[0];
  const dirty = Object.entries(values).some(([key, value]) => value !== (baseline[key] === undefined ? "" : String(baseline[key])));
  const productOptions = products.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()));

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
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/inventory?summary=1", { cache: "no-store", signal: controller.signal })
      .then(async res => { if (!res.ok) throw new Error(); return res.json() as Promise<{products: {id:number;total:number;counted:number}[]; enabled: boolean}>; })
      .then(data => { setSummary(data.products); setEnabled(data.enabled); })
      .catch(() => { if (!controller.signal.aborted) setSummary([]); });
    return () => controller.abort();
  }, [reload]);

  function choose(value: string) {
    if (Number(value) === productId) return;
    if (dirty && !window.confirm("Discard your unsaved stock count changes?")) return;
    setLoading(Number(value) !== 0); setBaseline({}); setReserved({}); setHistory([]); setValues({}); setMessage(""); setSelectedColor(""); setFillCount(""); setProductId(Number(value));
  }
  async function toggleProtection() {
    if (dirty) { setMessage("Save or discard the current stock changes before changing protection."); return; }
    const prompt = enabled ? "Turn off stock protection? Customers can order beyond the recorded counts." : "Enable stock protection? Products remain visible, but options without an available stock count cannot be ordered.";
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

  return <section aria-label="Inventory" className="admin-inventory">
    <div className="admin-block-head"><div><h2 className="h3">Inventory</h2><p className="small muted">Choose a product to update the quantities you have in stock.</p></div></div>
    <div className="banner-note"><p>{enabled ? "Stock protection is on. Products remain visible, but customers can only order options with stock available." : "Stock protection is off for customizable products. Ready-made products still require stock."}</p><details><summary>Stock protection settings</summary><p className="hint">Pending payments hold stock until checkout is completed or closed.</p><button type="button" className="btn btn-light btn-sm" disabled={saving || loading || !products.length} onClick={() => void toggleProtection()}>{enabled ? "Turn off stock protection" : "Enable stock protection"}</button></details></div>
    {message ? <p className="banner-note" role="status">{message}</p> : null}
    {!products.length ? <p>No products yet.</p> : !productId ? <>
      <label className="field admin-inventory-product">Find a product<input className="input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search product name" /></label>
      {productOptions.length ? <div className="admin-inventory-cards">{productOptions.map(item => {
        const progress = summary.find(entry => entry.id === item.id);
        const status = !item.active ? "Hidden product" : !progress ? "Stock status unavailable" : progress.counted === 0 ? "Add stock" : progress.counted < progress.total ? "Stock partly added" : "Stock added";
        return <button className="admin-inventory-card" type="button" key={item.id} disabled={saving} onClick={() => choose(String(item.id))}>
          <span className="admin-inventory-card-image"><ProductPhotography product={item} color={item.colors[0]} decorative /></span>
          <span className="admin-inventory-card-details"><strong>{item.name}</strong><span className="admin-inventory-card-status">{status}</span><span className="admin-inventory-card-action">Manage stock <span aria-hidden="true">→</span></span></span>
        </button>;
      })}</div> : <p className="hint">No products match that search.</p>}
    </> : <>
      <button type="button" className="link admin-inventory-back" disabled={saving} onClick={() => choose("0")}>← All products</button>
      {loading ? <InlineSkeleton label="Loading stock counts" /> : product ? <>
        <div className="admin-inventory-selected"><span className="admin-inventory-selected-image"><ProductPhotography product={product} color={product.colors[0]} decorative /></span><div><h3>{product.name}</h3><p className="hint">Choose a color, enter the quantity for each size, then save.</p></div></div>
        <form onSubmit={save}>
          <p className="hint">Enter how many you have, including items held for pending orders. Leave unknown quantities blank; enter 0 when out of stock.</p>
          <fieldset className="admin-inventory-color-picker"><legend>Choose a color</legend><div className="admin-inventory-color-options">{product.colors.map(color => <button key={color.id} type="button" className={`admin-inventory-color-option${activeColor?.id === color.id ? " is-selected" : ""}`} aria-label={color.name} aria-pressed={activeColor?.id === color.id} title={color.name} disabled={saving} onClick={() => { setSelectedColor(color.name); setFillCount(""); }}><span style={{ backgroundColor: color.hex }} aria-hidden="true" /></button>)}</div></fieldset>
          {activeColor ? <fieldset className="admin-inventory-color" key={activeColor.id}><legend><span className="admin-inventory-swatch" style={{ backgroundColor: activeColor.hex }} aria-hidden="true" /><span className="sr-only">{activeColor.name}</span> Stock quantities</legend>
            <div className="admin-inventory-fill"><label className="field">Same quantity for every size<input className="input" type="number" min="0" max="1000000" step="1" inputMode="numeric" value={fillCount} onChange={event => setFillCount(event.target.value)} /></label><button type="button" className="btn btn-light btn-sm" disabled={saving || !/^\d+$/.test(fillCount) || Number(fillCount) > 1000000} onClick={() => { setValues(current => ({ ...current, ...Object.fromEntries(product.sizes.map(size => [keyFor(activeColor.name, size.label), fillCount])) })); setMessage(""); }}>Apply to all sizes</button></div>
            <div className="admin-inventory-grid">{product.sizes.map(size => { const key = keyFor(activeColor.name, size.label); return <label className="field" key={key}>{size.label}<input className="input" type="number" min={reserved[key] ?? 0} max="1000000" step="1" inputMode="numeric" required={baseline[key] !== undefined} disabled={saving} value={values[key] ?? ""} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} aria-label={`${activeColor.name}, ${size.label} stock`} />{reserved[key] ? <span className="hint">{reserved[key]} held</span> : null}</label>; })}</div>
          </fieldset> : <p>No colors are available for this product.</p>}
          <button type="submit" className="btn" disabled={saving}>{saving ? "Saving…" : "Save stock"}</button>
        </form>
        <details className="admin-inventory-history"><summary>Recent stock changes</summary>{history.length ? <ul>{history.map((entry, index) => { const color = product.colors.find(item => item.name === entry.color_name); return <li key={index}><span className="admin-inventory-swatch" style={{ backgroundColor: color?.hex ?? "transparent" }} title={entry.color_name} aria-label={entry.color_name} role="img" />{entry.size_label}: {entry.previous_quantity === null ? "not entered" : entry.previous_quantity} → {entry.new_quantity} <span className="muted">({new Date(entry.created_at).toLocaleString()})</span></li>; })}</ul> : <p className="muted">No stock changes yet.</p>}</details>
      </> : null}
    </>}
    <details className="admin-inventory-advanced"><summary>Pending payment holds</summary><PaymentHolds disabled={dirty} onChanged={() => { if (productId) setLoading(true); setReload(n => n + 1); }} /></details>
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

