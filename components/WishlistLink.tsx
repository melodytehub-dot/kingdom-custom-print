"use client";
import Link from "next/link";
import { useWishlist } from "@/lib/wishlist-context";
export default function WishlistLink() {
  const { slugs } = useWishlist();
  return <Link href="/wishlist" className="mm-action-btn hide-sm" aria-label={`Wishlist (${slugs.length} items)`}>
    <span className="wishlist-symbol" aria-hidden="true">♡</span>
    {slugs.length > 0 ? <span className="mm-badge" aria-hidden="true">{slugs.length}</span> : null}
  </Link>;
}
