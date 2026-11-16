import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HomeContent from "@/components/HomeContent";
import HomepagePreviewBridge from "@/components/admin/HomepagePreviewBridge";
import { ADMIN_COOKIE, adminConfigured, validateSession } from "@/lib/admin-auth";
import { HOMEPAGE_DRAFT_KEY, publishedHomepageLayout, readHomepageLayout } from "@/lib/homepage-layout-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Homepage preview", robots: { index: false, follow: false } };

export default async function HomepagePreview() {
  const jar = await cookies();
  if (!adminConfigured() || !await validateSession(jar.get(ADMIN_COOKIE)?.value ?? null)) redirect("/admin");
  const layout = await readHomepageLayout(HOMEPAGE_DRAFT_KEY) ?? await publishedHomepageLayout();
  return <><HomepagePreviewBridge /><HomeContent layout={layout} preview /></>;
}
