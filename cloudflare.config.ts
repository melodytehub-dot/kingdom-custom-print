import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "kingdom-custom-print",
    entrypoint: "worker.ts",
    compatibilityDate: "2026-10-28",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      VINEXT_KV_CACHE: bindings.kv({ id: "b93c6df2d79f47f8ae6e5b0d560c35bc" }),
      HYPERDRIVE: bindings.hyperdrive({ id: "a8072149025844fda414261954600d3e" }),
    },
  }),
});
