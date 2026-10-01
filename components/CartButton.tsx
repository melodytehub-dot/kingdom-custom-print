"use client";

import Link from "next/link";
import CartIcon from "./icons/CartIcon";
import { useCart } from "@/lib/cart-context";

export default function CartButton() {
  const { count, hydrated } = useCart();
  const showCount = hydrated && count > 0;

  return (
    <Link
      href="/cart"
      className="cart-btn"
      aria-label={
        hydrated && count > 0
          ? `Cart, ${count} item${count === 1 ? "" : "s"}`
          : "Cart, empty"
      }
    >
      <CartIcon />
      {showCount ? (
        <span className="cart-count tnum" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}