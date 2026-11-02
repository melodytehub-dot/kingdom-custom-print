import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminConfigured,
  createSession,
  passwordMatches,
  pruneSessions,
} from "@/lib/admin-auth";
import { authAttemptAllowed, sameOrigin } from "@/lib/customer-auth";
import { limitedJson } from "@/lib/limited-form-data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Admin access is not set up on this deployment." },
      { status: 503 }
    );
  }

  let allowed: boolean;
  try { allowed = await authAttemptAllowed(req, "__admin_login__"); }
  catch { return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again." }, { status: 503 }); }
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  let password = "";
  try {
    const body = (await limitedJson(req, 4096)) as { password?: string };
    password = String(body.password ?? "");
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "That password is not correct." }, { status: 401 });
  }

  await pruneSessions();
  const token = await createSession();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 3600,
  });
  return res;
}
