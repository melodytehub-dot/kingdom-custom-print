"use client";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "../components/ProductCard";
import { PRODUCTS } from "../lib/products";

function ShopInner() {
  const sp = useSearchParams();
  const q = (sp.get("q") ?? "").toLowerCase();
  const cat = sp.get("cat") ?? "";
  const list = useMemo(() => PRODUCTS.filter((p) =>
    (!cat || p.kind === cat) &&
    (!q || (p.name + p.blurb + p.kind).toLowerCase().includes(q))
  ), [q, cat]);
  return (
    <div className="wrap" style={{ paddingTop: 26, paddingBottom: 30 }}>
      <p className="eyebrow">Shop</p>
      <h1 style={{ margin: "6px 0" }}>All products</h1>
      <p className="muted" style={{ marginTop: 0 }}>{list.length} styles · prices shown for blanks before print</p>
      {list.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <p><strong>No matches.</strong></p>
          <p className="muted small">Try a different search, or start from a blank in the studio.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }} className="shopgrid">
          {list.map((p) => <ProductCard key={p.slug} p={p} />)}
        </div>
      )}
      <style>{`@media(max-width:900px){.shopgrid{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:560px){.shopgrid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}

export default function ShopPage() {
  return <Suspense fallback={<div className="wrap" style={{ padding: 40 }}>Loading…</div>}><ShopInner /></Suspense>;
}
