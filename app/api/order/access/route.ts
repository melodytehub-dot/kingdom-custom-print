import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/customer-auth";
import { limitedJson } from "@/lib/limited-form-data";
import {
  ORDER_ACCESS_COOKIE,
  orderAccessAttemptAllowed,
  orderAccessCookieOptions,
  verifyGuestOrder,
} from "@/lib/order-access";

export const dynamic = "force-dynamic";

const REFERENCE_RE = /^KCP-[A-Z2-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: { reference?: string; email?: string };
  try {
    body = (await limitedJson(request, 4096)) as { reference?: string; email?: string };
  } catch (error) {
    if (error instanceof RangeError) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const reference = String(body.reference ?? "").trim().toUpperCase();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!REFERENCE_RE.test(reference) || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Check the order reference and email address." }, { status: 422 });
  }
  if (!(await orderAccessAttemptAllowed(request, reference))) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }

  const token = await verifyGuestOrder(reference, email);
  if (!token) {
    return NextResponse.json({ error: "The reference and email did not match an order." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, href: `/order/${encodeURIComponent(reference)}` });
  response.cookies.set(ORDER_ACCESS_COOKIE, token, orderAccessCookieOptions());
  response.headers.set("Cache-Control", "no-store");
  return response;
}
