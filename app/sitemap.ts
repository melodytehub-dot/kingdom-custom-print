import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog";
import { readCustomPages } from "@/lib/custom-pages-store";
import { listBuilderPages } from "@/lib/builder/store";
import { EDITABLE_STORE_SLUGS } from "@/lib/builder/schema";
import { publicSiteUrl } from "@/lib/site-url";

function canonicalBase() {
  return publicSiteUrl();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = canonicalBase();
  const [products, pages, builderPages] = await Promise.all([
    getProducts().catch(() => []),
    readCustomPages().catch(() => []),
    listBuilderPages().catch(() => []),
  ]);
  const publicPages = [
    "",
    "/shop",
    "/customize",
    "/about",
    "/contact",
    "/shipping",
    "/faq",
    "/privacy",
    "/terms",
  ];
  const builtinSet = new Set<string>(EDITABLE_STORE_SLUGS);
  const builderSet = new Set(builderPages.filter((p) => p.published).map((p) => p.slug));

  return [
    ...publicPages.map((path, index) => ({
      url: `${base}${path}`,
      changeFrequency: (path === "/shop" || path === "" ? "weekly" : "monthly") as
        "weekly" | "monthly",
      priority: index === 0 ? 1 : path === "/shop" ? 0.9 : 0.6,
    })),
    ...products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...builderPages
      .filter((page) => page.published && !builtinSet.has(page.slug))
      .map((page) => ({
        url: `${base}/${page.slug}`,
        lastModified: new Date(page.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    ...pages
      .filter((page) => page.published && !builderSet.has(page.slug))
      .map((page) => ({
        url: `${base}/${page.slug}`,
        lastModified: new Date(page.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
  ];
}
