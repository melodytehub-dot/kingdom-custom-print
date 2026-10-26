import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog";

function canonicalBase() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
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
