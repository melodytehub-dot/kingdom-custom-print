import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog";
import { publicSiteUrl } from "@/lib/site-url";

function canonicalBase() {
  return publicSiteUrl();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = canonicalBase();
  const products = await getProducts().catch(() => []);
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
  ];
}
