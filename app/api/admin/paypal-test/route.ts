import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "../_guard";
import { paypalRequest } from "@/lib/paypal";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";
const cookieName = "kcp_paypal_test";
type Capture = { id?: string; status?: string; amount?: { currency_code?: string; value?: string } };
type PayPalOrder = { id?: string; status?: string; purchase_units?: { custom_id?: string; amount?: { currency_code?: string; value?: string }; payments?: { captures?: Capture[] } }[]; links?: { rel: string; href: string }[] };

async function checkedOrder(id: string): Promise<PayPalOrder> {
  if (!/^[A-Z0-9]{1,20}$/.test(id)) throw new Error("Invalid test order");
  const order = await paypalRequest<PayPalOrder>(`/v2/checkout/orders/${id}`);
  const unit = order.purchase_units?.[0];
  if (order.id !== id || unit?.custom_id !== "KCP-ADMIN-ONE-DOLLAR-TEST" || unit.amount?.currency_code !== "USD" || unit.amount.value !== "1.00") throw new Error("Not a one-dollar test order");
  return order;
}

export async function POST(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  let body: { action?: string; token?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  try {
    if (body.action === "start") {
      const base = siteUrl();
      const order = await paypalRequest<PayPalOrder>("/v2/checkout/orders", {
        method: "POST", requestId: `test-${randomUUID()}`,
        body: JSON.stringify({ intent: "CAPTURE", purchase_units: [{ custom_id: "KCP-ADMIN-ONE-DOLLAR-TEST", description: "Kingdom Custom Print $1 payment test (no merchandise)", amount: { currency_code: "USD", value: "1.00" } }], payment_source: { paypal: { experience_context: { return_url: `${base}/admin/paypal-test`, cancel_url: `${base}/admin/paypal-test?cancelled=1`, user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING" } } } }),
      });
      const approval = order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
      if (!order.id || !/^[A-Z0-9]{1,20}$/.test(order.id) || !approval || !/^https:\/\/(www\.)?paypal\.com\//i.test(approval)) throw new Error("Invalid provider response");
      const res = NextResponse.json({ url: approval });
      res.cookies.set(cookieName, order.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 86400 });
      return res;
    }
    const cookie = req.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const id = typeof body.token === "string" ? body.token : "";
    if (!cookie || cookie !== id) return NextResponse.json({ error: "Test order does not match this browser. Return to the original browser and sign in again." }, { status: 400 });
    let order = await checkedOrder(id);
    if (body.action === "capture" && order.status === "APPROVED") {
      try { await paypalRequest(`/v2/checkout/orders/${id}/capture`, { method: "POST", body: "{}", requestId: `test-capture-${id}` }); }
      catch { /* Check provider state before allowing a retry. */ }
      order = await checkedOrder(id);
    }
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (body.action === "refund") {
      if (!capture?.id || !/^[A-Z0-9]{1,20}$/.test(capture.id) || capture.amount?.value !== "1.00" || capture.amount.currency_code !== "USD" || capture.status !== "COMPLETED") throw new Error("No completed test payment to refund");
      const refund = await paypalRequest<{ status?: string }>(`/v2/payments/captures/${capture.id}/refund`, { method: "POST", body: "{}", requestId: `test-refund-${capture.id}` });
      return NextResponse.json({ orderStatus: order.status, captureStatus: capture.status, refundStatus: refund.status ?? "unknown" });
    }
    if (body.action !== "capture" && body.action !== "status") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    return NextResponse.json({ orderStatus: order.status, captureStatus: capture?.status ?? null });
  } catch {
    return NextResponse.json({ error: "PayPal could not complete this step. Check the PayPal dashboard before retrying to avoid duplicate transactions." }, { status: 502 });
  }
}
