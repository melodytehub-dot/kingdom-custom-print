import { getPaymentCredential } from "./payment-credentials";

export async function paypalConfigured(): Promise<boolean> {
  // Kept off until sandbox and live webhook integration are verified.
  if (process.env.PAYPAL_CHECKOUT_ENABLED !== "true") return false;
  const values = await Promise.all([getPaymentCredential("PAYPAL_CLIENT_ID"), getPaymentCredential("PAYPAL_CLIENT_SECRET"), getPaymentCredential("PAYPAL_WEBHOOK_ID"), getPaymentCredential("PAYPAL_ENVIRONMENT")]);
  if (process.env.NODE_ENV === "production" && values[3] === "sandbox" && process.env.ALLOW_TEST_PAYMENTS !== "true") return false;
  return values.slice(0, 3).every(Boolean) && (values[3] === "live" || values[3] === "sandbox");
}

async function paypalBase(): Promise<string> {
  const mode = await getPaymentCredential("PAYPAL_ENVIRONMENT");
  if (mode === "live") return "https://api-m.paypal.com";
  if (mode === "sandbox") return "https://api-m.sandbox.paypal.com";
  throw new Error("PayPal environment is not configured.");
}

async function accessToken(): Promise<string> {
  const [id, secret] = await Promise.all([getPaymentCredential("PAYPAL_CLIENT_ID"), getPaymentCredential("PAYPAL_CLIENT_SECRET")]);
  if (!id || !secret) throw new Error("PayPal is not configured.");
  const response = await fetch(`${await paypalBase()}/v1/oauth2/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials", cache: "no-store" });
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
  const response = await fetch(`${await paypalBase()}${path}`, { method: options.method ?? "GET", headers, body: options.body, cache: "no-store" });
  if (!response.ok) throw new Error(`PayPal request failed (${response.status}).`);
  return await response.json() as T;
}
