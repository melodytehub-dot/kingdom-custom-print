import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import BuilderPageView from "@/components/builder/BuilderPageView";
import { ADMIN_COOKIE, adminConfigured, validateSession } from "@/lib/admin-auth";
import { readBuilderDraft } from "@/lib/builder/store";
import { isBuilderSlug } from "@/lib/builder/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Page preview",
  robots: { index: false, follow: false },
};

/** Renders the saved draft for a signed-in administrator. Never public. */
export default async function BuilderPreview({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  if (!adminConfigured()) notFound();
  const token = (await cookies()).get(ADMIN_COOKIE)?.value ?? null;
  if (!(await validateSession(token))) notFound();

  const { slug } = await searchParams;
  if (!slug || !isBuilderSlug(slug)) notFound();

  const draft = await readBuilderDraft(slug);
  if (!draft) notFound();

  return <BuilderPageView page={draft.page} />;
}
