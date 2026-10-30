import type { Metadata } from "next";
import { paymentsConfigured } from "@/lib/stripe";
import CheckoutForm from "@/components/CheckoutForm";
import { getSettings } from "@/lib/catalog";
import { customerFromCookies } from "@/lib/customer-auth";
import { paypalConfigured } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [settings, account] = await Promise.all([getSettings(), customerFromCookies()]);

  return (
    <>

      <CheckoutForm settings={settings} paymentsReady={await paymentsConfigured()} paypalReady={await paypalConfigured()} account={account ? { email: account.email, name: account.name } : null} />
    </>
  );
}
