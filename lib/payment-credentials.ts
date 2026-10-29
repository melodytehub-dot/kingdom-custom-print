import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { sql } from "./db";

export const PAYMENT_FIELDS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID", "PAYPAL_ENVIRONMENT"] as const;
export type PaymentField = (typeof PAYMENT_FIELDS)[number];

function encryptionKey(): Buffer | null {
  const value = process.env.PAYMENT_CREDENTIALS_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) return null;
  return Buffer.from(value, "hex");
}

export function paymentVaultConfigured(): boolean { return encryptionKey() !== null; }

export function encryptPaymentCredential(name: PaymentField, value: string): string {
  const key = encryptionKey();
  if (!key) throw new Error("Payment settings are not configured on this deployment.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(name));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decrypt(name: PaymentField, text: string): string {
  const key = encryptionKey();
  if (!key) throw new Error("Payment settings are not configured on this deployment.");
  const [version, iv, tag, encrypted] = text.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid payment credential record.");
  const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  cipher.setAAD(Buffer.from(name));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([cipher.update(Buffer.from(encrypted, "base64url")), cipher.final()]).toString("utf8");
}

export async function getPaymentCredential(name: PaymentField): Promise<string | null> {
  if (paymentVaultConfigured()) {
    const [row] = await sql<{ ciphertext: string }[]>`SELECT ciphertext FROM payment_credentials WHERE name = ${name}`;
    if (row) return decrypt(name, row.ciphertext);
  }
  return process.env[name]?.trim() || null;
}

export async function savePaymentCredentials(values: Partial<Record<PaymentField, string>>): Promise<void> {
  const rows = Object.entries(values).map(([name, value]) => ({ name: name as PaymentField, ciphertext: encryptPaymentCredential(name as PaymentField, value!) }));
  await sql.begin(async (tx) => {
    for (const row of rows) await tx`INSERT INTO payment_credentials (name, ciphertext) VALUES (${row.name}, ${row.ciphertext}) ON CONFLICT (name) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = now()`;
  });
}

export async function paymentCredentialStatus(): Promise<Record<PaymentField, boolean>> {
  const stored = paymentVaultConfigured() ? await sql<{ name: string }[]>`SELECT name FROM payment_credentials` : [];
  const names = new Set(stored.map((row) => row.name));
  return Object.fromEntries(PAYMENT_FIELDS.map((name) => [name, names.has(name) || Boolean(process.env[name]?.trim())])) as Record<PaymentField, boolean>;
}
