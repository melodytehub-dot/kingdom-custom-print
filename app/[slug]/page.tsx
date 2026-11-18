import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CustomPageView from "@/components/CustomPageView";
import BuilderPageView from "@/components/builder/BuilderPageView";
import { publishedCustomPage } from "@/lib/custom-pages-store";
import { readPublishedBuilderPage } from "@/lib/builder/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const builderPage = await readPublishedBuilderPage(slug);
  if (builderPage) {
    return {
      title: builderPage.title,
      description: builderPage.description || undefined,
      robots: { index: true, follow: true },
    };
  }
  const page = await publishedCustomPage(slug);
  if (!page) return { title: "Page not found", robots: { index: false, follow: false } };
  return {
    title: page.title,
    description: page.description || undefined,
    robots: { index: true, follow: true },
  };
}

/**
 * Serves pages an administrator publishes in the dashboard.
 *
 * Pages built in the visual editor take precedence; pages created in the older
 * block editor keep rendering unchanged.
 */
export default async function CustomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const builderPage = await readPublishedBuilderPage(slug);
  if (builderPage) return <BuilderPageView page={builderPage} />;

  const page = await publishedCustomPage(slug);
  if (!page) notFound();
  return <CustomPageView page={page} />;
}
