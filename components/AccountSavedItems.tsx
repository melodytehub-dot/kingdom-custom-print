"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useWishlist } from "@/lib/wishlist-context";
import type { Product } from "@/lib/types";
import type { SavedDraft } from "@/lib/design";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("focus", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("focus", callback); };
}
function snapshot() {
  try { return localStorage.getItem("kcp.drafts.v1") ?? "[]"; } catch { return "[]"; }
}

export default function AccountSavedItems({ products }: { products: Product[] }) {
  const { slugs, toggle } = useWishlist();
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  let drafts: SavedDraft[] = [];
  try { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) drafts = parsed.filter((d): d is SavedDraft => !!d && typeof d.id === "string" && typeof d.productSlug === "string" && typeof d.productName === "string"); } catch { /* Ignore invalid saved data. */ }
  const favorites = products.filter((product) => slugs.includes(product.slug));
  return <>
    <section className="account-section" id="wishlist" aria-labelledby="wishlist-title">
      <h2 id="wishlist-title">Wishlist</h2>
      <p>Favorites saved on this device.</p>
      {favorites.length ? <ul className="account-saved-list">{favorites.map((product) => <li key={product.id}>
        <Link href={`/product/${product.slug}`}>{product.name}</Link>
        <button type="button" onClick={() => toggle(product.slug)} aria-label={`Remove ${product.name} from wishlist`}>Remove</button>
      </li>)}</ul> : <p>No favorites yet. <Link href="/shop">Browse products</Link></p>}
    </section>
    <section className="account-section" id="designs" aria-labelledby="designs-title">
      <h2 id="designs-title">Saved designs</h2>
      <p>Designs saved on this device.</p>
      {drafts.length ? <ul className="account-saved-list">{drafts.map((draft) => <li key={draft.id}>
        <span><strong>{draft.productName}</strong><small>{draft.colorName}</small></span>
        <Link href={`/customize/${encodeURIComponent(draft.productSlug)}?savedDesign=${encodeURIComponent(draft.id)}`}>Continue designing</Link>
      </li>)}</ul> : <p>No saved designs yet. <Link href="/customize">Start designing</Link></p>}
    </section>
  </>;
}
