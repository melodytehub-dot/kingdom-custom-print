import { sql } from "./db";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_HOURS = 12;

export function adminConfigured(): boolean {
  const pass = process.env.ADMIN_PASSWORD;
  return typeof pass === "string" && pass.length >= 12;
}

/** Constant-time comparison to avoid leaking the password through timing. */
export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // timingSafeEqual requires equal-length buffers, so hash both sides first.
  return timingSafeEqual(
    createHash("sha256").update(input).digest(),
    createHash("sha256").update(expected).digest()
  );
}

export async function createSession(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  await sql`
    INSERT INTO admin_sessions (token, expires_at) VALUES (${token}, ${expires})`;
  return token;
}

export async function validateSession(token: string | null): Promise<boolean> {
  if (!token) return false;
  const rows = await sql<{ ok: number }[]>`
    SELECT 1 AS ok FROM admin_sessions
    WHERE token = ${token} AND expires_at > now()`;
  return rows.length > 0;
}

export async function destroySession(token: string): Promise<void> {
  await sql`DELETE FROM admin_sessions WHERE token = ${token}`;
}

export const ADMIN_COOKIE = "kcp_admin";

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Best-effort cleanup of expired sessions; called on login. */
export async function pruneSessions(): Promise<void> {
  await sql`DELETE FROM admin_sessions WHERE expires_at <= now()`;
}