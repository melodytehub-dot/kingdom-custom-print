import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../_guard";
import { limitedJson } from "@/lib/limited-form-data";
import { getCategories } from "@/lib/catalog";
import { listBuilderPages } from "@/lib/builder/store";
import { STORE_PAGE_CATALOG } from "@/lib/builder/builtin-pages";
import {
  getNavigationMenus,
  parseNavigationMenus,
  resetNavigationMenus,
  saveNavigationMenus,
} from "@/lib/navigation-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const [menus, categories, builderPages] = await Promise.all([
    getNavigationMenus(),
    getCategories(),
    listBuilderPages(),
  ]);

  const builtinSlugs = new Set<string>(STORE_PAGE_CATALOG.map((p) => p.slug));
  const customPages = builderPages
    .filter((p) => p.published && !builtinSlugs.has(p.slug))
    .map((p) => ({ label: p.title || p.slug, href: `/${p.slug}` }));

  const storePages = [
    { label: "Home", href: "/" },
    { label: "Shop All", href: "/shop" },
    { label: "Design Studio", href: "/customize" },
    ...STORE_PAGE_CATALOG.map((p) => ({ label: p.title, href: p.path })),
    { label: "Track Order", href: "/track" },
    { label: "My Account", href: "/account" },
  ];

  const categoryLinks = categories.map((c) => ({
    label: c.name,
    href: `/shop?category=${encodeURIComponent(c.slug)}`,
  }));

  return NextResponse.json({
    menus,
    suggestions: { storePages, customPages, categoryLinks },
  });
}

export async function PUT(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await limitedJson(req, 65536);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = parseNavigationMenus(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Check each menu label and link. Every menu needs at least one valid link." },
      { status: 422 }
    );
  }

  await saveNavigationMenus(parsed);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, menus: parsed });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const menus = await resetNavigationMenus();
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, menus });
}
