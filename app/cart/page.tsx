import type { Metadata } from "next";
import Link from "next/link";
import CartView from "@/components/CartView";
import { getSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const [settings, params] = await Promise.all([getSettings(), searchParams]);

  return (
    <>
      {params.cancelled ? (
        <div className="wrap">
          <p className="banner-note" role="status">
            Checkout was cancelled. Your cart is unchanged.
          </p>
        </div>
      ) : null}

      <CartView
        shippingFlat={settings.shippingFlat}
        freeThreshold={settings.freeShippingThreshold}
      />

      <div className="wrap">
        <p className="small muted cart-foot">
          Need a bulk quote for more than 100 garments?{" "}
          <Link href="/contact" className="link-inline">
            Get in touch
          </Link>
          .
        </p>
      </div>
    </>
  );
}