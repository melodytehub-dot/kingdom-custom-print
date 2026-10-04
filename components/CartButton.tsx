"use client";

import Link from "next/link";
import CartIcon from "./icons/CartIcon";
import { useCart } from "@/lib/cart-context";
import { formatUSD } from "@/lib/pricing";

export default function CartButton() {
  const { count, subtotal, hydrated } = useCart();
  const showCount = hydrated && count > 0;

  return (
    <Link
      href="/cart"
      className="mm-header-cart-wrap"
      aria-label={
        hydrated && count > 0
          ? `Shopping cart with ${count} item${count === 1 ? "" : "s"}, subtotal ${formatUSD(subtotal)}`
          : "Shopping cart, 0 items"
      }
    >
      <div className="mm-action-btn">
        <CartIcon />
        <span className="mm-badge" aria-hidden="true">
          {showCount ? (count > 99 ? "99+" : count) : "0"}
        </span>
      </div>
      <div className="mm-cart-info hide-sm">
        <span className="mm-cart-label">Cart</span>
        <span className="mm-cart-total tnum">
          {hydrated ? formatUSD(subtotal) : "$0.00"}
        </span>
      </div>
    </Link>
  );
}