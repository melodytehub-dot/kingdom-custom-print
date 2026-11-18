import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CustomPageView from "@/components/CustomPageView";
import BuilderPageView from "@/components/builder/BuilderPageView";
import { publishedCustomPage } from "@/lib/custom-pages-store";
import { readPublishedBuilderPage } from "@/lib/builder/store";
import { DEFAULT_SETTINGS, getProducts, getSettings } from "@/lib/catalog";
import { emailConfigured } from "@/lib/email";

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
  if (builderPage) {
    const [products, settings] = await Promise.all([
      getProducts().catch(() => []),
      getSettings().catch(() => DEFAULT_SETTINGS),
    ]);
    const contactEmail = process.env.SUPPORT_EMAIL?.trim() || settings.contactEmail;
    return (
      <BuilderPageView
        page={builderPage}
        products={products}
        settings={{ ...settings, contactEmail }}
        canSendEmail={emailConfigured() && Boolean(process.env.SUPPORT_EMAIL)}
      />
    );
  }

  const page = await publishedCustomPage(slug);
  if (!page) notFound();
  return <CustomPageView page={page} />;
}
