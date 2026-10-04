"use client";
import { useRouter, useSearchParams } from "next/navigation";
export default function ShopSort({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();
  return <div className="sort-control"><label htmlFor="shop-sort" className="sort-label">Sort by</label><select id="shop-sort" className="sort-toggle" value={current} onChange={(event) => {
    const next = new URLSearchParams(params.toString());
    next.set("sort", event.target.value);
    router.push(`/shop?${next.toString()}`, { scroll: false });
  }}><option value="featured">Featured</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name A-Z</option></select></div>;
}
