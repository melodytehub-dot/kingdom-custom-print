import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { CUSTOMER_COOKIE, createCustomerSession, customerCookieOptions, normalizedEmail } from "@/lib/customer-auth";
import { googleClient, GOOGLE_NONCE_COOKIE, GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE } from "@/lib/google-auth";

export const runtime = "nodejs";

function sameSecret(a: string | undefined, b: string | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function finish(request: NextRequest, result: string, token?: string) {
  const response = NextResponse.redirect(new URL(result === "ok" ? "/account" : `/account?google=${result}`, request.url));
  for (const key of [GOOGLE_STATE_COOKIE, GOOGLE_NONCE_COOKIE, GOOGLE_VERIFIER_COOKIE]) {
    response.cookies.set(key, "", { path: "/api/account/google", maxAge: 0 });
  }
  if (token) response.cookies.set(CUSTOMER_COOKIE, token, customerCookieOptions());
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  if (query.has("error")) return finish(request, "cancelled");

  const client = googleClient(request.url);
  const code = query.get("code");
  const verifier = request.cookies.get(GOOGLE_VERIFIER_COOKIE)?.value;
  const nonce = request.cookies.get(GOOGLE_NONCE_COOKIE)?.value;
  if (!client || !code || !verifier || !nonce || !sameSecret(request.cookies.get(GOOGLE_STATE_COOKIE)?.value, query.get("state"))) {
    return finish(request, "invalid");
  }

  try {
    const { tokens } = await client.getToken({ code, codeVerifier: verifier });
    if (!tokens.id_token) return finish(request, "invalid");
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();
    if (!profile?.sub || !profile.email_verified || !profile.email || !sameSecret(nonce, profile.nonce ?? null)) {
      return finish(request, "invalid");
    }

    const email = normalizedEmail(profile.email);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return finish(request, "invalid");
    const name = String(profile.name || email.split("@")[0]).slice(0, 100);
    const authoritative = email.endsWith("@gmail.com") || Boolean(profile.hd);

    const [linked] = await sql<{ id: number }[]>`SELECT id FROM customer_accounts WHERE google_sub = ${profile.sub} LIMIT 1`;
    let accountId = linked?.id;
    if (!accountId) {
      const [existing] = await sql<{ id: number; google_sub: string | null }[]>`SELECT id, google_sub FROM customer_accounts WHERE email = ${email} LIMIT 1`;
      if (existing) {
        if (!authoritative || existing.google_sub) return finish(request, "account-exists");
        const [updated] = await sql<{ id: number }[]>`
          UPDATE customer_accounts SET google_sub = ${profile.sub}
          WHERE id = ${existing.id} AND google_sub IS NULL RETURNING id`;
        accountId = updated?.id;
      } else {
        const disabledPassword = `google:${randomBytes(32).toString("hex")}`;
        const [created] = await sql<{ id: number }[]>`
          INSERT INTO customer_accounts (email, name, password_hash, google_sub)
          VALUES (${email}, ${name}, ${disabledPassword}, ${profile.sub}) RETURNING id`;
        accountId = created?.id;
      }
    }
    if (!accountId) return finish(request, "invalid");
    const token = await createCustomerSession(accountId);
    return finish(request, "ok", token);
  } catch (error) {
    console.error("Google sign-in failed", error);
    return finish(request, "unavailable");
  }
}
