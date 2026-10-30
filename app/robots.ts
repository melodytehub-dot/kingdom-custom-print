import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/site-url";

function canonicalBase() {
  return publicSiteUrl();
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
