import type { MetadataRoute } from "next";

function canonicalBase() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const base = canonicalBase();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/account",
        "/admin",
        "/cart",
        "/checkout",
        "/order/",
        "/track",
        "/wishlist",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
