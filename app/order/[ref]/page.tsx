import type { Metadata } from "next";
import Link from "next/link";
import OrderDetail from "@/components/OrderDetail";
import { getOrderByReference } from "@/lib/orders";

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
  const order = await getOrderByReference(decodeURIComponent(ref));

  if (!order) {
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
              Double-check the reference from your confirmation email. It is in the form
              KCP-XXXXXX.
            </p>
            <div className="state-actions">
              <Link href="/track" className="btn">
                Try another reference
              </Link>
              <Link href="/contact" className="btn btn-ghost">
                Contact us
              </Link>
            </div>
          </div>
        </div>
      </>
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