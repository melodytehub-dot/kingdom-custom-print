import { NextResponse } from "next/server";
import { capturePayPalOrder } from "@/lib/paypal-capture";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const reference = await capturePayPalOrder(id);
    if (reference) return NextResponse.redirect(`${siteUrl()}/order/success?ref=${encodeURIComponent(reference)}`);
  } catch { console.error("PayPal capture or receipt processing failed."); }
  return NextResponse.redirect(`${siteUrl()}/cart?paypal=unavailable`);
}
