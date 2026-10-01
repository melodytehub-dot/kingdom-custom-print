import Garment from "@/components/Garment";
import { ORDER_STATUSES, describeDesign } from "@/lib/types";
import type { OrderSummary } from "@/lib/orders";

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default function OrderDetail({ order }: { order: OrderSummary }) {
  const current = ORDER_STATUSES.find((s) => s.value === order.status);
  const steps = ORDER_STATUSES.filter((s) => s.value !== "cancelled");
  const activeIndex = steps.findIndex((s) => s.value === order.status);

  return (
    <div className="order-view">
      <div className="order-head">
        <div>
          <p className="eyebrow">Order</p>
          <h1 className="h2 tnum">{order.reference}</h1>
          <p className="small muted">
            Placed {new Date(order.createdAt).toLocaleDateString()} · {order.email}
          </p>
        </div>
        <span className={`badge status-${order.status}`}>
          {current?.label ?? order.status}
        </span>
      </div>

      {order.status !== "cancelled" ? (
        <ol className="status-track" aria-label="Order progress">
          {steps.map((s, i) => (
            <li
              key={s.value}
              className={`track-step${i <= activeIndex ? " is-done" : ""}${
                i === activeIndex ? " is-current" : ""
              }`}
              aria-current={i === activeIndex ? "step" : undefined}
            >
              <span className="track-dot" aria-hidden="true" />
              <span className="track-label">{s.label}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <section className="order-items" aria-label="Items">
        <h2 className="h3">Items</h2>
        <ul>
          {order.items.map((item, i) => (
            <li key={i} className="order-item">
              <div className="order-thumb">
                {item.previewFront ?? item.previewBack ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(item.previewFront ?? item.previewBack) as string}
                    alt={`${item.productName} in ${item.colorName} with your design`}
                  />
                ) : (
                  <Garment kind={item.productKind} color={item.colorHex} />
                )}
              </div>

              <div className="grow">
                <p className="order-item-name wrap-anywhere">{item.productName}</p>
                <p className="small muted">
                  {item.colorName} · {describeDesign(item.design)}
                </p>
                <ul className="order-sizes">
                  {item.sizeBreakdown
                    .filter((s) => s.qty > 0)
                    .map((s) => (
                      <li key={s.label}>
                        {s.label} × {s.qty}
                      </li>
                    ))}
                </ul>
              </div>

              <p className="order-item-qty tnum">×{item.quantity}</p>
              <p className="order-item-price tnum">
                {money(item.unitPrice * item.quantity)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="order-foot">
        <dl className="summary-list">
          <div>
            <dt>Subtotal</dt>
            <dd className="tnum">{money(order.subtotal)}</dd>
          </div>
          <div>
            <dt>Shipping</dt>
            <dd className="tnum">{order.shipping === 0 ? "Free" : money(order.shipping)}</dd>
          </div>
          <div className="summary-total">
            <dt>Total</dt>
            <dd className="tnum">{money(order.total)}</dd>
          </div>
        </dl>

        {order.status === "pending" ? (
          <p className="hint">
            Payment instructions have been sent to {order.email}. We start production
            once payment clears.
          </p>
        ) : null}
      </div>
    </div>
  );
}