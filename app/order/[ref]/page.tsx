import { notFound } from "next/navigation";
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
  if (!order) notFound();

  return (
    <>
      <div className="wrap page-head">
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb">
            <li>
              <Link href="/">Home</Link>
            </li>
            <li aria-current="page">Order {order.reference}</li>
          </ol>
        </nav>
      </div>
      <div className="wrap section-tight">
        <OrderDetail order={order} />
      </div>
    </>
  );
}