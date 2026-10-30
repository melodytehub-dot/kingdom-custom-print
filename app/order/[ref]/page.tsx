import type { Metadata } from "next";
import Link from "next/link";
import OrderDetail from "@/components/OrderDetail";
import GuestOrderAccess from "@/components/GuestOrderAccess";
import { customerFromCookies } from "@/lib/customer-auth";
import { guestCanAccessOrderFromCookies } from "@/lib/order-access";
import {
  getOrderByReference,
  getPublicOrderStatus,
  orderBelongsToAccount,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const reference = decodeURIComponent(ref).trim().toUpperCase().slice(0, 32);
  const publicOrder = await getPublicOrderStatus(reference);

  if (!publicOrder) {
    return (
      <>
        <div className="wrap section-tight">
          <div className="state">
            <svg className="state-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="2" />
              <path d="M24 15v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="24" cy="32" r="1.4" fill="currentColor" />
            </svg>
            <h1 className="h3">We could not find that order</h1>
            <p>
              Double-check the reference shown after checkout. It is in the form KCP-XXXXXX.
            </p>
            <div className="state-actions">
              <Link href="/contact" className="btn">Contact us</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const account = await customerFromCookies();
  const [ownedByAccount, guestAccess] = await Promise.all([
    orderBelongsToAccount(reference, account?.id ?? null),
    guestCanAccessOrderFromCookies(reference),
  ]);
  const canViewDetails = ownedByAccount || guestAccess;
  const order = canViewDetails ? await getOrderByReference(reference) : null;

  if (!order) {
    return (
      <div className="wrap section-tight">
        <div className="panel panel-pad order-view">
          <div className="order-head">
            <div>
              <p className="eyebrow">Order</p>
              <h1 className="h2 tnum">{publicOrder.reference}</h1>
              <p className="small muted">
                Placed {new Date(publicOrder.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="state">
            <h2 className="h3">Verify to view full order details</h2>
            <p>
              Enter your checkout email to view your items, artwork, notes, delivery details, and totals.
            </p>
            <GuestOrderAccess reference={publicOrder.reference} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="wrap section-tight">
        <OrderDetail order={order} />
      </div>
    </>
  );
}
