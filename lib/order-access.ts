import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";
import { normalizedEmail } from "./customer-auth";

const ACCESS_HOURS = 24;
export const ORDER_ACCESS_COOKIE = "kcp_order_access";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validToken(token: string | null): token is string {
  return Boolean(token && /^[A-Za-z0-9_-]{43}$/.test(token));
}

export function orderAccessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_HOURS * 3600,
  };
}

export async function createOrderAccessSession(reference: string): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + ACCESS_HOURS * 3_600_000);
  const rows = await sql<{ id: number }[]>`
    SELECT id FROM orders WHERE reference = ${reference} LIMIT 1`;
  if (!rows.length) return null;

  await sql.begin(async (tx) => {
    await tx`DELETE FROM order_access_sessions WHERE expires_at <= now()`;
    await tx`INSERT INTO order_access_sessions (token_hash, order_id, expires_at)
      VALUES (${tokenHash(token)}, ${rows[0].id}, ${expires})`;
  });
  return token;
}

export async function verifyGuestOrder(reference: string, email: string): Promise<string | null> {
  const rows = await sql<{ reference: string }[]>`
    SELECT reference FROM orders
    WHERE reference = ${reference} AND lower(email) = ${normalizedEmail(email)}
    LIMIT 1`;
  return rows.length ? createOrderAccessSession(reference) : null;
}

export async function guestCanAccessOrder(reference: string, token: string | null): Promise<boolean> {
  if (!validToken(token)) return false;
  const rows = await sql<{ allowed: boolean }[]>`
    SELECT true AS allowed FROM order_access_sessions s
    JOIN orders o ON o.id = s.order_id
    WHERE s.token_hash = ${tokenHash(token)}
      AND s.expires_at > now()
      AND o.reference = ${reference}
    LIMIT 1`;
  return Boolean(rows[0]?.allowed);
}

export async function guestCanAccessOrderFromCookies(reference: string): Promise<boolean> {
  const token = (await cookies()).get(ORDER_ACCESS_COOKIE)?.value ?? null;
  return guestCanAccessOrder(reference, token);
}

export async function orderAccessAttemptAllowed(request: Request, reference: string): Promise<boolean> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = createHash("sha256").update(`${ip}:${reference}`).digest("hex");
  const [row] = await sql<{ attempts: number }[]>`
    INSERT INTO order_access_attempts (key, attempts, reset_at)
    VALUES (${key}, 1, now() + interval '15 minutes')
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN order_access_attempts.reset_at < now() THEN 1 ELSE order_access_attempts.attempts + 1 END,
      reset_at = CASE WHEN order_access_attempts.reset_at < now() THEN now() + interval '15 minutes' ELSE order_access_attempts.reset_at END
    RETURNING attempts`;
  return row.attempts <= 10;
}
