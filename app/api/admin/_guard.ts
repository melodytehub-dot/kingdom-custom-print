import { NextResponse } from "next/server";
import { adminConfigured, readSessionCookie, validateSession } from "@/lib/admin-auth";

/** Returns a 401 response when the caller is not an authenticated admin. */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Admin access is not set up on this deployment." },
      { status: 503 }
    );
  }
  const token = readSessionCookie(req);
  const ok = await validateSession(token);
  if (!ok) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return null;
}
