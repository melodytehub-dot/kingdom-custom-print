"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import GarmentSVG from "../../components/GarmentSVG";
import { formatUSD } from "../../lib/pricing";
import { getProduct } from "../../lib/products";
import { useStore } from "../../lib/store";

export default function ProductDetail() {
  const { slug } = useParams() as { slug: string };
  const product = useMemo(() => getProduct(slug), [slug]);
  const { addToCart, toggleWish, wishlist } = useStore();
  const [color, setColor] = useState(product.colors[0]);
  const [size, setSize] = useState<string>("M");
  const [qty, setQty] = useState(1);
  const wished = wishlist.includes(product.slug);
  return (
    <div className="wrap" style={{ paddingTop: 26, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}>
      <div className="card" style={{ background: "var(--paper)", padding: 24 }}>
        {product.badge && <span style={{ background: product.badge === "Sale" ? "var(--red)" : "#111", color: "#fff", fontSize: 11, fontWeight: 800, padding: "5px 10px", borderRadius: 20, letterSpacing: ".08em", textTransform: "uppercase" }}>{product.badge}</span>}
        <GarmentSVG kind={product.kind} hex={color.hex} id={product.slug} />
      </div>
      <div>
        <p className="eyebrow">{product.kind}</p>
        <h1 style={{ margin: "6px 0" }}>{product.name}</h1>
        <p style={{ fontSize: 20, fontWeight: 800 }}>{formatUSD(product.basePrice)} <span className="muted small" style={{ fontWeight: 400 }}>blank · + print in studio</span></p>
        <p className="muted">{product.blurb}</p>
        <label className="lbl" htmlFor="color">Color — {color.name}</label>
        <div style={{ display: "flex", gap: 8 }} role="radiogroup" aria-label="Color">
          {product.colors.map((c) => (
            <button key={c.id} role="radio" aria-checked={c.id === color.id} title={c.name} onClick={() => setColor(c)} style={{ width: 30, height: 30, borderRadius: "50%", background: c.hex, border: c.id === color.id ? "2px solid #111" : "1px solid #00000033", cursor: "pointer" }} />
          ))}
        </div>
        <label className="lbl" htmlFor="size" style={{ marginTop: 16 }}>Size</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label="Size">
          {product.sizes.map((s) => <button key={s} role="radio" aria-checked={s === size} onClick={() => setSize(s)} className="btn ghost" style={{ padding: "9px 14px", borderColor: s === size ? "#111" : "var(--line)", background: s === size ? "#111" : "#fff", color: s === size ? "#fff" : "#111" }}>{s}</button>)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
          <label className="lbl" htmlFor="qty" style={{ margin: 0 }}>Qty</label>
          <input id="qty" className="input" type="number" min={1} max={999} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 90 }} />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <Link href={`/customize?product=${product.slug}&color=${color.id}&size=${size}&qty=${qty}`} className="btn">Customize it</Link>
          <button className="btn ghost" onClick={() => {
            const unit = product.basePrice;
            addToCart({ key: `${Date.now()}`, productSlug: product.slug, productName: product.name, kind: product.kind, colorId: color.id, colorName: color.name, colorHex: color.hex, sides: { front: [], back: [] }, previewFront: null, previewBack: null, lines: [{ size, qty }], unit, total: unit * qty, count: qty, createdAt: Date.now() });
          }}>Add blank to cart</button>
          <button className="btn ghost" aria-pressed={wished} onClick={() => toggleWish(product.slug)}>{wished ? "♥ Saved" : "♡ Save"}</button>
        </div>
        <ul className="small muted" style={{ marginTop: 18, paddingLeft: 18 }}>
          <li>Print pricing added in the studio: {formatUSD(product.printFeePerSide)} per printed side.</li>
          <li>Automatic bulk savings at 6, 12 and 24+ units.</li>
          <li>Free US shipping over $75 · 30-day reprint policy.</li>
        </ul>
      </div>
      <style>{`@media(max-width:900px){div.wrap[style*="1fr 1fr"]{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}
