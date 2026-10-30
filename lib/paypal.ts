import { getPaymentCredential } from "./payment-credentials";

export async function paypalCredentialsConfigured(): Promise<boolean> {
  const values = await Promise.all([getPaymentCredential("PAYPAL_CLIENT_ID"), getPaymentCredential("PAYPAL_CLIENT_SECRET"), getPaymentCredential("PAYPAL_WEBHOOK_ID")]);
  return values.every(Boolean);
}

export async function paypalConfigured(): Promise<boolean> {
  return process.env.PAYPAL_CHECKOUT_ENABLED === "true" && await paypalCredentialsConfigured();
}

const PAYPAL_BASE = "https://api-m.paypal.com";

export class PayPalRequestError extends Error {
  constructor(public readonly status: number, public readonly issue: string | null) {
    super(`PayPal request failed (${status}).`);
    this.name = "PayPalRequestError";
  }
}

async function accessToken(): Promise<string> {
  const [id, secret] = await Promise.all([getPaymentCredential("PAYPAL_CLIENT_ID"), getPaymentCredential("PAYPAL_CLIENT_SECRET")]);
  if (!id || !secret) throw new Error("PayPal is not configured.");
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status}).`);
  const result = await response.json() as { access_token?: string };
  if (!result.access_token) throw new Error("PayPal authentication response was invalid.");
  return result.access_token;
}

export async function paypalRequest<T>(path: string, options: { method?: "GET" | "POST"; body?: string; requestId?: string } = {}): Promise<T> {
  if (!/^\/v[12]\/[a-zA-Z0-9/_-]+$/.test(path)) throw new Error("Invalid PayPal API path.");
  const token = await accessToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" };
  if (options.requestId) headers["PayPal-Request-Id"] = options.requestId;
  const response = await fetch(`${PAYPAL_BASE}${path}`, { method: options.method ?? "GET", headers, body: options.body, cache: "no-store" });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { name?: unknown; details?: { issue?: unknown }[] } | null;
    const candidate = error?.details?.[0]?.issue ?? error?.name;
    const issue = typeof candidate === "string" && /^[A-Z0-9_]{1,100}$/.test(candidate) ? candidate : null;
    throw new PayPalRequestError(response.status, issue);
  }
  return await response.json() as T;
}
