import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../_guard";
import { getSettings, saveSettings, type SiteSettings } from "@/lib/catalog";
import { HERO_IMAGES } from "@/lib/hero-slides";

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
  const image = (value: unknown, fallback: string) => typeof value === "string" && HERO_IMAGES.some((item) => item.src === value) ? value : fallback;
  const str = (v: unknown, max = 500) => String(v ?? "").slice(0, max);
  const numField = (v: unknown, fallback: number, max = 100000) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.min(max, Math.round(n * 100) / 100);
  };

  await saveSettings({
    heroLabel: str(body.heroLabel ?? current.heroLabel, 80),
    heroHeadlineTop: str(body.heroHeadlineTop ?? current.heroHeadlineTop, 100),
    heroHeadlineBottom: str(body.heroHeadlineBottom ?? current.heroHeadlineBottom, 100),
    heroDescription: str(body.heroDescription ?? current.heroDescription, 350),
    heroImage1: image(body.heroImage1, current.heroImage1),
    heroImage2: image(body.heroImage2, current.heroImage2),
    heroImage3: image(body.heroImage3, current.heroImage3),
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

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
