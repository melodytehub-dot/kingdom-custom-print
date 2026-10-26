import Link from "next/link";
import GuestOrderAccess from "@/components/GuestOrderAccess";
import { customerFromCookies } from "@/lib/customer-auth";
import { guestCanAccessOrderFromCookies } from "@/lib/order-access";
import {
  getOrderByReference,
  getPublicOrderStatus,
  orderBelongsToAccount,
} from "@/lib/orders";

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
  const reference = ref ? decodeURIComponent(ref).trim().toUpperCase().slice(0, 32) : "";
  const publicOrder = reference ? await getPublicOrderStatus(reference) : null;
  const account = await customerFromCookies();
  const canViewDetails = publicOrder
    ? (await orderBelongsToAccount(reference, account?.id ?? null))
      || (await guestCanAccessOrderFromCookies(reference))
    : false;
  const order = canViewDetails ? await getOrderByReference(reference) : null;
  const paymentConfirmed =
    !!publicOrder &&
    publicOrder.status !== "pending" &&
    publicOrder.status !== "cancelled";

  return (
    <div className="wrap section">
      <div className="panel panel-pad order-done">
        <p className="eyebrow">
          {paymentConfirmed ? "Payment received" : "Order received"}
        </p>
        <h1 className="h2">
          {paymentConfirmed ? "Thank you — your order is in" : "Your payment is awaiting confirmation"}
        </h1>

        {publicOrder ? (
          <>
            <p className="lede">
              Reference <strong className="tnum">{publicOrder.reference}</strong>.{" "}
              {paymentConfirmed
                ? "Payment is confirmed."
                : "We are waiting for payment confirmation. Production begins only after payment is confirmed."}
            </p>
            {order ? (
              <ul className="done-list">
                {order.items.map((i, idx) => (
                  <li key={idx} className="wrap-anywhere">
                    {i.quantity} × {i.productName}
                    {i.colorName ? ` (${i.colorName})` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="state">
                <p>
                  For privacy, verify the checkout email to see items, artwork, notes,
                  delivery information, and totals.
                </p>
                <GuestOrderAccess reference={publicOrder.reference} />
              </div>
            )}
            <p className="small muted">
              We proof your artwork before production. Keep your reference to follow
              progress on the order page.
            </p>
            <div className="state-actions">
              <Link href={`/order/${publicOrder.reference}`} className="btn">
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
              We could not find an order for that reference. Use the reference shown
              after checkout, or track another order.
            </p>
            <div className="state-actions">
              <Link href="/track" className="btn">Track an order</Link>
              <Link href="/shop" className="btn btn-ghost">Keep shopping</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
