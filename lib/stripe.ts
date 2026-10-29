import Stripe from "stripe";
import { publicSiteUrl } from "./site-url";
import { getPaymentCredential } from "./payment-credentials";

let cached: Stripe | null = null;
let cachedKey: string | null = null;

export async function stripeClient(): Promise<Stripe | null> {
  const key = await getPaymentCredential("STRIPE_SECRET_KEY");
  if (!key) return null;
  if (!cached || cachedKey !== key) {
    cached = new Stripe(key, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
      appInfo: { name: "Kingdom Custom Print" },
    });
    cachedKey = key;
  }
  return cached;
}

export function siteUrl(): string {
  return publicSiteUrl();
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export async function paymentsConfigured(): Promise<boolean> {
  if (process.env.STRIPE_CHECKOUT_ENABLED !== "true") return false;
  const [key, webhook] = await Promise.all([getPaymentCredential("STRIPE_SECRET_KEY"), getPaymentCredential("STRIPE_WEBHOOK_SECRET")]);
  if (!key || !webhook) return false;
  // Never let a test charge on the live storefront look like a real order.
  if (process.env.NODE_ENV === "production" && /^(sk|rk)_test_/.test(key) && process.env.ALLOW_TEST_PAYMENTS !== "true") return false;
  return true;
}
