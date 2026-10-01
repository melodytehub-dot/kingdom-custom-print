"use client";

import { useState } from "react";
import Link from "next/link";
import Garment from "@/components/Garment";
import Trash from "@/components/icons/Trash";
import ArrowRight from "@/components/icons/ArrowRight";
import { useCart } from "@/lib/cart-context";
import { describeDesign, type CartItem } from "@/lib/types";

export default function CartView({
  shippingFlat,
  freeThreshold,
}: {
  shippingFlat: number;
  freeThreshold: number;
}) {
  const { items, hydrated, updateLine, removeItem, subtotal } = useCart();
  const [removing, setRemoving] = useState<string | null>(null);

  const remaining = Math.max(0, freeThreshold - subtotal);
  const qualifies = remaining <= 0 && subtotal > 0;

  if (!hydrated) {
    return (
      <div className="wrap section">
        <p className="muted" role="status">
          Loading your cart…
        </p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="wrap section">
        <div className="state">
          <svg className="state-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path
              d="M8 14h32l-3 24a4 4 0 0 1-4 3.5H15A4 4 0 0 1 11 38z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M17 20v-5a7 7 0 0 1 14 0v5" stroke="currentColor" strokeWidth="2" />
          </svg>
          <h2 className="h3">Your cart is empty</h2>
          <p>
            Browse the blanks, then customize one and it will appear here with your
            artwork attached.
          </p>
          <div className="state-actions">
            <Link href="/customize" className="btn">
              Start designing
            </Link>
            <Link href="/shop" className="btn btn-ghost">
              Browse blanks
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap section-tight cart-layout">
      <section aria-label="Cart items">
        <div className="cart-head">
          <h1 className="h2">Your cart</h1>
          <p className="small muted">
            {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
            {items.reduce((n, i) => n + i.quantity, 0)} garment
            {items.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"}
          </p>
        </div>

        <ul className="cart-list">
          {items.map((item) => (
            <CartRow
              key={item.id}
              item={item}
              busy={removing === item.id}
              onQty={(label, qty) => updateLine(item.id, label, qty)}
              onRemove={() => {
                setRemoving(item.id);
                removeItem(item.id);
              }}
            />
          ))}
        </ul>
      </section>

      <aside className="cart-summary" aria-label="Order summary">
        <div className="panel panel-pad">
          <h2 className="h3">Summary</h2>

          <dl className="summary-list">
            <div>
              <dt>Subtotal</dt>
              <dd className="tnum">{money(subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd className="tnum">
                {qualifies ? "Free" : money(shippingFlat)}
              </dd>
            </div>
            <div className="summary-total">
              <dt>Total</dt>
              <dd className="tnum">{money(subtotal + (qualifies ? 0 : shippingFlat))}</dd>
            </div>
          </dl>

          {qualifies ? (
            <p className="ship-note is-free">
              Free shipping applied on orders over {money(freeThreshold)}.
            </p>
          ) : (
            <div className="ship-progress">
              <p className="small">
                Add <strong>{money(remaining)}</strong> more for free shipping.
              </p>
              <div
                className="ship-bar"
                role="progressbar"
                aria-valuenow={Math.round(
                  (Math.min(subtotal, freeThreshold) / Math.max(freeThreshold, 1)) * 100
                )}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progress toward free shipping"
              >
                <span
                  style={{
                    width: `${Math.min(100, (subtotal / Math.max(freeThreshold, 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <Link href="/checkout" className="btn btn-lg btn-block">
            Checkout
            <ArrowRight />
          </Link>

          <p className="hint">
            You will confirm sizes and artwork on the next step before payment.
          </p>

          <Link href="/shop" className="link cart-continue">
            Continue shopping
          </Link>
        </div>
      </aside>
    </div>
  );
}

function CartRow({
  item,
  busy,
  onQty,
  onRemove,
}: {
  item: CartItem;
  busy: boolean;
  onQty: (label: string, qty: number) => void;
  onRemove: () => void;
}) {
  const preview = item.previewFront ?? item.previewBack;

  return (
    <li className={`cart-row${busy ? " is-busy" : ""}`}>
      <div className="cart-thumb">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`${item.productName} in ${item.colorName} with your design`} />
        ) : (
          <Garment kind={item.productKind} color={item.colorHex} />
        )}
      </div>

      <div className="cart-info">
        <div className="cart-info-head">
          <div className="grow">
            <h2 className="cart-title wrap-anywhere">
              <Link href={`/product/${item.productSlug}`}>{item.productName}</Link>
            </h2>
            <p className="small muted cart-meta">
              <span
                className="cart-swatch"
                style={{ background: item.colorHex }}
                aria-hidden="true"
              />
              {item.colorName} · {describeDesign(item.design)}
            </p>
          </div>
          <p className="cart-price tnum">{money(item.total)}</p>
        </div>

        <ul className="cart-sizes">
          {item.lines
            .filter((l) => l.qty > 0)
            .map((l) => (
              <li key={l.label}>
                <span className="cart-size-label">{l.label}</span>
                <span className="size-stepper">
                  <button
                    type="button"
                    onClick={() => onQty(l.label, l.qty - 1)}
                    aria-label={`Decrease ${l.label} quantity`}
                  >
                    &minus;
                  </button>
                  <span className="tnum" aria-label={`${l.label} quantity`}>
                    {l.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onQty(l.label, l.qty + 1)}
                    aria-label={`Increase ${l.label} quantity`}
                  >
                    +
                  </button>
                </span>
              </li>
            ))}
        </ul>

        <div className="cart-actions">
          <Link href={`/customize/${item.productSlug}`} className="link">
            Edit design
          </Link>
          <button type="button" className="cart-remove" onClick={onRemove}>
            <Trash />
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}