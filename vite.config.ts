import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import path from "node:path";

// Vinext consumes next.config.ts, but Cloudflare's native cloudflare:workers
// module must remain external to the Worker build rather than using Next's stub.
process.env.KCP_VINEXT = "1";

export default defineConfig({
  plugins: [
    vinext({
      cache: {
        data: kvDataAdapter({ binding: "VINEXT_KV_CACHE" }),
      },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  resolve: {
    alias: {
      "sharp": path.resolve(process.cwd(), "empty-stub.js"),
    },
  },
});
