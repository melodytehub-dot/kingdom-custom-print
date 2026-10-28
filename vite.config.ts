import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { kvDataAdapter } from "@vinext/cloudflare/cache/kv-data-adapter";
import path from "node:path";

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
