import { NextResponse } from "next/server";
import { ADMIN_COOKIE, destroySession, readSessionCookie } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = readSessionCookie(req);
  if (token) await destroySession(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
