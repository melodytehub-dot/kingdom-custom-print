"use client";
import Link from "next/link";
import ProductCard from "./ProductCard";
import { useWishlist } from "@/lib/wishlist-context";
import type { Product } from "@/lib/types";
export default function WishlistView({ products }: { products: Product[] }) {
  const { slugs } = useWishlist();
  const saved = products.filter((product) => slugs.includes(product.slug));
  return saved.length ? <ul className="mm-product-grid">{saved.map((product) => <li key={product.id}><ProductCard product={product} /></li>)}</ul> : <div className="state"><h2>Your next idea starts here</h2><p>Save garments from the catalog to keep your favorites together on this device.</p><Link href="/shop" className="btn">Explore the catalog</Link></div>;
}
