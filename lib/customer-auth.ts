import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { sql } from "./db";

const derive = promisify(scrypt);
const SESSION_DAYS = 30;
export const CUSTOMER_COOKIE = "kcp_customer";

export type CustomerAccount = { id: number; email: string; name: string };

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function passwordValid(password: string, stored: string): Promise<boolean> {
  const [method, salt, encoded] = stored.split(":");
  if (method !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(encoded ?? "")) return false;
  const expected = Buffer.from(encoded, "hex");
  const actual = (await derive(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}

export async function createCustomerSession(accountId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await sql`INSERT INTO customer_sessions (token_hash, account_id, expires_at)
    VALUES (${tokenHash(token)}, ${accountId}, ${expires})`;
  return token;
}

export function customerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  };
}

export async function customerFromToken(token: string | null): Promise<CustomerAccount | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [account] = await sql<CustomerAccount[]>`
    SELECT a.id, a.email, a.name FROM customer_accounts a
    JOIN customer_sessions s ON s.account_id = a.id
    WHERE s.token_hash = ${tokenHash(token)} AND s.expires_at > now()
    LIMIT 1`;
  return account ?? null;
}

function requestCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${CUSTOMER_COOKIE}=`));
  return entry ? entry.slice(CUSTOMER_COOKIE.length + 1) : null;
}

export function customerFromRequest(request: Request): Promise<CustomerAccount | null> {
  return customerFromToken(requestCookie(request));
}

export async function customerFromCookies(): Promise<CustomerAccount | null> {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value ?? null;
  return customerFromToken(token);
}

export async function endCustomerSession(request: Request): Promise<void> {
  const token = requestCookie(request);
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await sql`DELETE FROM customer_sessions WHERE token_hash = ${tokenHash(token)}`;
  }
}

export async function authAttemptAllowed(request: Request, email: string): Promise<boolean> {
  const ip = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = createHash("sha256").update(`${ip}:${email}`).digest("hex");
  const [row] = await sql<{ attempts: number }[]>`
    INSERT INTO customer_auth_attempts (key, attempts, reset_at)
    VALUES (${key}, 1, now() + interval '15 minutes')
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN customer_auth_attempts.reset_at < now() THEN 1 ELSE customer_auth_attempts.attempts + 1 END,
      reset_at = CASE WHEN customer_auth_attempts.reset_at < now() THEN now() + interval '15 minutes' ELSE customer_auth_attempts.reset_at END
    RETURNING attempts`;
  return row.attempts <= 10;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}
