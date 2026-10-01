import Link from "next/link";
const CATS = [
  { name: "T-Shirts", href: "/shop?cat=tee", note: "Heavyweight everyday tees" },
  { name: "Hoodies & Crews", href: "/shop?cat=hoodie", note: "Fleece and midweight" },
  { name: "Headwear", href: "/shop?cat=cap", note: "Snapbacks and Dad hats" },
  { name: "Drinkware & Merch", href: "/shop?cat=mug", note: "Mugs and extras" }
];
export default function Collections() {
  return (
    <div className="wrap" style={{ paddingTop: 26 }}>
      <p className="eyebrow">Collections</p>
      <h1 style={{ margin: "6px 0" }}>Shop by category</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginTop: 14 }}>
        {CATS.map((c) => <Link key={c.name} href={c.href} className="card" style={{ padding: 22 }}><strong>{c.name}</strong><p className="muted small" style={{ margin: "6px 0 0" }}>{c.note} →</p></Link>)}
      </div>
    </div>
  );
}
