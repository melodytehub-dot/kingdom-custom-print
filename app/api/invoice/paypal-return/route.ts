import { NextResponse } from "next/server";
import { capturePayPalInvoice } from "@/lib/invoice-payments";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const providerId = query.get("token") ?? "";
  try { await capturePayPalInvoice(providerId); } catch { /* The verified webhook may still confirm payment. */ }
  return NextResponse.redirect(`${siteUrl()}/invoice/payment-result`, { headers: { "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" } });
}
