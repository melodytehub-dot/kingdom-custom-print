"use client";
import ProductCard from "../components/ProductCard";
import { PRODUCTS } from "../lib/products";
import { useStore } from "../lib/store";

export default function WishlistPage() {
  const { wishlist } = useStore();
  const list = PRODUCTS.filter((p) => wishlist.includes(p.slug));
  return (
    <div className="wrap" style={{ paddingTop: 26 }}>
      <p className="eyebrow">Wishlist</p>
      <h1 style={{ margin: "6px 0" }}>Saved styles</h1>
      {list.length === 0 ? <p className="muted">Nothing saved yet. Tap the heart on any product to keep it here.</p> :
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>{list.map((p) => <ProductCard key={p.slug} p={p} />)}</div>}
    </div>
  );
}
