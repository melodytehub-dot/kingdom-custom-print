import Link from "next/link";
import { getOrderByReference } from "@/lib/orders";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Order received",
  robots: { index: false, follow: false },
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const order = ref ? await getOrderByReference(decodeURIComponent(ref)) : null;

  return (
    <div className="wrap section">
      <div className="panel panel-pad order-done">
        <p className="eyebrow">Payment received</p>
        <h1 className="h2">Thank you — your order is in</h1>

        {order ? (
          <>
            <p className="lede">
              Reference <strong className="tnum">{order.reference}</strong>. Payment is
              confirmed and your order details are below.
            </p>
            <ul className="done-list">
              {order.items.map((i, idx) => (
                <li key={idx} className="wrap-anywhere">
                  {i.quantity} × {i.productName}
                  {i.colorName ? ` (${i.colorName})` : ""}
                </li>
              ))}
            </ul>
            <p className="small muted">
              We proof your artwork before production. Keep your reference to follow
              progress on the order page.
            </p>
            <div className="state-actions">
              <Link href={`/order/${order.reference}`} className="btn">
                View order
              </Link>
              <Link href="/shop" className="btn btn-ghost">
                Keep shopping
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="lede">
              Your payment went through. We could not load the order details just now —
              contact us with the reference from your confirmation.
            </p>
            <Link href="/shop" className="btn">
              Keep shopping
            </Link>
          </>
        )}
      </div>
    </div>
  );
}