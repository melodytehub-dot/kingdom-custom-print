"use client";
import Link from "next/link";
import GarmentSVG from "./GarmentSVG";
import { formatUSD } from "../lib/pricing";
import type { Product } from "../lib/products";
import { useStore } from "../lib/store";

export default function ProductCard({ p }: { p: Product }) {
  const { wishlist, toggleWish } = useStore();
  const wished = wishlist.includes(p.slug);
  return (
    <article className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", background: "var(--paper)", padding: 18 }}>
        {p.badge && <span style={{ position: "absolute", top: 10, left: 10, background: p.badge === "Sale" ? "var(--red)" : "#7a9a3a", color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", padding: "5px 9px", borderRadius: 20 }}>{p.badge}</span>}
        <button aria-label={wished ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={wished} onClick={() => toggleWish(p.slug)} style={{ position: "absolute", top: 8, right: 8, background: "#fff", border: "1px solid var(--line)", width: 34, height: 34, borderRadius: 4, cursor: "pointer", fontSize: 17 }}>{wished ? "♥" : "♡"}</button>
        <Link href={`/product/${p.slug}`} aria-label={p.name}><GarmentSVG kind={p.kind} hex={p.colors[0].hex} id={p.slug} /></Link>
      </div>
      <div style={{ padding: "14px 14px 16px", display: "grid", gap: 6 }}>
        <span className="eyebrow">{p.kind}</span>
        <Link href={`/product/${p.slug}`} style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</Link>
        <span style={{ fontSize: 15 }}>{formatUSD(p.basePrice)}{p.compareAt ? <s className="muted" style={{ marginLeft: 8 }}>{formatUSD(p.compareAt)}</s> : null} <span className="muted small">· blank</span></span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }} aria-label="Available colors">
          {p.colors.slice(0, 3).map((c) => <span key={c.id} title={c.name} style={{ width: 18, height: 18, borderRadius: "50%", background: c.hex, border: "1px solid #00000033", display: "inline-block" }} />)}
          {p.colors.length > 3 && <span className="small muted">+{p.colors.length - 3}</span>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <Link href={`/customize?product=${p.slug}`} className="btn" style={{ flex: 1, padding: "11px 8px" }}>Customize</Link>
          <Link href={`/product/${p.slug}`} className="btn ghost" style={{ flex: 1, padding: "11px 8px" }}>Details</Link>
        </div>
      </div>
    </article>
  );
}
