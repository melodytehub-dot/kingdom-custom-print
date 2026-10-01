import type { Metadata } from "next";
import Link from "next/link";
import CheckoutForm from "@/components/CheckoutForm";
import { getSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const settings = await getSettings();

  return (
    <>
      <nav aria-label="Breadcrumb" className="wrap">
        <ol className="breadcrumb" style={{ paddingTop: 22 }}>
          <li>
            <Link href="/cart">Cart</Link>
          </li>
          <li aria-current="page">Checkout</li>
        </ol>
      </nav>

      <CheckoutForm settings={settings} />
    </>
  );
}