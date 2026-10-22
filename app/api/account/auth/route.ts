import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  CUSTOMER_COOKIE,
  authAttemptAllowed,
  createCustomerSession,
  customerCookieOptions,
  normalizedEmail,
  passwordHash,
  passwordValid,
  sameOrigin,
} from "@/lib/customer-auth";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DUMMY_HASH = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  let body: { mode?: string; email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const mode = body.mode;
  const email = normalizedEmail(String(body.email ?? ""));
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  if (mode !== "register" && mode !== "login") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (email.length > 254 || !EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 422 });
  if (password.length > 200 || (mode === "register" && password.length < 10)) {
    return NextResponse.json({ error: "Use a password of at least 10 characters." }, { status: 422 });
  }
  if (mode === "register" && (name.length < 2 || name.length > 100)) {
    return NextResponse.json({ error: "Enter your name." }, { status: 422 });
  }

  try {
    if (!(await authAttemptAllowed(request, email))) {
      return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    }

    let accountId: number;
    if (mode === "register") {
      const hash = await passwordHash(password);
      const [account] = await sql<{ id: number }[]>`
        INSERT INTO customer_accounts (email, name, password_hash)
        VALUES (${email}, ${name}, ${hash})
        ON CONFLICT (email) DO NOTHING RETURNING id`;
      if (!account) return NextResponse.json({ error: "This email already has an account. Sign in instead." }, { status: 409 });
      accountId = account.id;
    } else {
      const [account] = await sql<{ id: number; password_hash: string }[]>`
        SELECT id, password_hash FROM customer_accounts WHERE email = ${email} LIMIT 1`;
      if (!(await passwordValid(password, account?.password_hash ?? DUMMY_HASH)) || !account) {
        return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
      }
      accountId = account.id;
    }

    const token = await createCustomerSession(accountId);
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(CUSTOMER_COOKIE, token, customerCookieOptions());
    return response;
  } catch (error) {
    console.error("Customer authentication failed", error);
    return NextResponse.json({ error: "Account access is temporarily unavailable." }, { status: 503 });
  }
}
