import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../_guard";
import { getSettings, HomepageContentConflict, saveSettings, type SiteSettings } from "@/lib/catalog";
import { isHomepageImage, isSafeHomepageLink, parseHomepageContent } from "@/lib/homepage-builder";
import { mediaExists } from "@/lib/media-storage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json(await getSettings());
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: Partial<SiteSettings> & { expectedHomepageContent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const current = await getSettings();
  const logo = body.siteLogo ?? current.siteLogo;
  const logoMatch = typeof logo === "string" ? /^\/api\/product-media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(logo) : null;
  if (logo !== "/brand/kingdom-logo.png" && (!logoMatch || !(await mediaExists("product", logoMatch[1])))) {
    return NextResponse.json({ error: "Choose a valid logo image and try again." }, { status: 422 });
  }
  for (const key of ["heroImage1", "heroImage2", "heroImage3"] as const) {
    const value = body[key] ?? current[key];
    const uploaded = typeof value === "string" ? /^\/api\/product-media\/([0-9a-f-]+)$/i.exec(value) : null;
    if (typeof value !== "string" || !isHomepageImage(value) || (uploaded && !(await mediaExists("product", uploaded[1])))) {
      return NextResponse.json({ error: "Choose a valid slideshow image and try again." }, { status: 422 });
    }
  }
  const image = (value: unknown, fallback: string) => typeof value === "string" && isHomepageImage(value) ? value : fallback;
  const str = (v: unknown, max = 500) => String(v ?? "").slice(0, max);
  const numField = (v: unknown, fallback: number, max = 100000) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.min(max, Math.round(n * 100) / 100);
  };

  const expectedHomepage = body.expectedHomepageContent === undefined ? undefined : parseHomepageContent(body.expectedHomepageContent);
  if (expectedHomepage === null) return NextResponse.json({ error: "The homepage settings could not be verified. Reload and try again." }, { status: 422 });
  try { await saveSettings({
    siteLogo: logo as string,
    heroLabel: str(body.heroLabel ?? current.heroLabel, 80),
    heroHeadlineTop: str(body.heroHeadlineTop ?? current.heroHeadlineTop, 100),
    heroHeadlineBottom: str(body.heroHeadlineBottom ?? current.heroHeadlineBottom, 100),
    heroDescription: str(body.heroDescription ?? current.heroDescription, 350),
    heroImage1: image(body.heroImage1, current.heroImage1),
    heroImage2: image(body.heroImage2, current.heroImage2),
    heroImage3: image(body.heroImage3, current.heroImage3),
    homeProductsTitle: str(body.homeProductsTitle ?? current.homeProductsTitle, 100),
    homeProductsDescription: str(body.homeProductsDescription ?? current.homeProductsDescription, 350),
    homeContactTitle: str(body.homeContactTitle ?? current.homeContactTitle, 100),
    homeContactDescription: str(body.homeContactDescription ?? current.homeContactDescription, 350),
    announcement: str(body.announcement ?? current.announcement, 160),
    announcementLink: typeof body.announcementLink === "string" && (body.announcementLink === "" || isSafeHomepageLink(body.announcementLink)) ? body.announcementLink : current.announcementLink,
    footerBlurb: str(body.footerBlurb ?? current.footerBlurb, 350),
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
  }, expectedHomepage); } catch (error) {
    if (error instanceof HomepageContentConflict) return NextResponse.json({ error: "Homepage content changed in another session. Reload the page before saving settings." }, { status: 409 });
    throw error;
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
