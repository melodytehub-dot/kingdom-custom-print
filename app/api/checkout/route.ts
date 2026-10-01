import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.items?.length) return NextResponse.json({ error: "Empty cart" }, { status: 400 });
  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const orderId = `KCP-${Date.now().toString(36).toUpperCase()}`;
  if (!secret) return NextResponse.json({ orderId, mode: "local" });
  const stripe = new Stripe(secret);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: body.email,
    line_items: body.items.map((i: { productName: string; count: number; unit: number }) => ({
      price_data: { currency: "usd", product_data: { name: String(i.productName).slice(0, 120) }, unit_amount: Math.round(Number(i.unit) * 100) },
      quantity: Number(i.count) || 1
    })),
    metadata: { orderId, itemCount: String(body.items.length) },
    success_url: `${siteUrl}/order/success?id=${orderId}`,
    cancel_url: `${siteUrl}/cart`
  });
  return NextResponse.json({ url: session.url, orderId });
}
