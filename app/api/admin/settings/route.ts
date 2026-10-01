import { NextResponse } from "next/server";
import { requireAdmin } from "../_guard";
import { getSettings, saveSettings, type SiteSettings } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json(await getSettings());
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: Partial<SiteSettings>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const current = await getSettings();
  const str = (v: unknown, max = 500) => String(v ?? "").slice(0, max);
  const numField = (v: unknown, fallback: number, max = 100000) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.min(max, Math.round(n * 100) / 100);
  };

  await saveSettings({
    announcement: str(body.announcement ?? current.announcement, 160),
    shippingFlat: numField(body.shippingFlat, current.shippingFlat, 999),
    freeShippingThreshold: numField(
      body.freeShippingThreshold,
      current.freeShippingThreshold,
      100000
    ),
    contactEmail: str(body.contactEmail ?? current.contactEmail, 120),
    contactPhone: str(body.contactPhone ?? current.contactPhone, 40),
    businessAddress: str(body.businessAddress ?? current.businessAddress, 200),
    productionDays: str(body.productionDays ?? current.productionDays, 120),
  });

  return NextResponse.json({ ok: true });
}
