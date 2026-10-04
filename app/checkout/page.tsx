import type { Metadata } from "next";
import { paymentsConfigured } from "@/lib/stripe";
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

      <CheckoutForm settings={settings} paymentsReady={paymentsConfigured()} />
    </>
  );
}