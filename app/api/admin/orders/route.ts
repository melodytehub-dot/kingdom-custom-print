import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { getAdminOrder, updateOrderStatus } from "@/lib/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const reference = new URL(req.url).searchParams.get("ref");
  if (!reference) {
    return NextResponse.json({ error: "Missing order reference." }, { status: 400 });
  }

  const order = await getAdminOrder(decodeURIComponent(reference));
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  return NextResponse.json(order);
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: { reference?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const reference = String(body.reference ?? "").slice(0, 32);
  const status = String(body.status ?? "") as OrderStatus;

  if (!reference || !ORDER_STATUSES.some((s) => s.value === status)) {
    return NextResponse.json({ error: "Unknown order or status." }, { status: 422 });
  }

  const ok = await updateOrderStatus(reference, status);
  if (!ok) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}