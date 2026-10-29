import Stripe from "stripe";
import { publicSiteUrl } from "./site-url";

let cached: Stripe | null = null;

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cached) {
    cached = new Stripe(key, {
      apiVersion: "2024-06-20",
      appInfo: { name: "Kingdom Custom Print" },
    });
  }
  return cached;
}

export function siteUrl(): string {
  return publicSiteUrl();
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function paymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
