import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(!process.env.KCP_VINEXT
    ? {
        turbopack: {
          resolveAlias: {
            "cloudflare:workers": "./lib/cloudflare-workers.stub.ts",
          },
        },
      }
    : {}),
  webpack(config) {
    if (!process.env.KCP_VINEXT) {
      config.resolve.alias["cloudflare:workers"] = "./lib/cloudflare-workers.stub.ts";
    }
    return config;
  },
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/img/printed-catalog/**", search: "?v=blank-1" },
    ],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
