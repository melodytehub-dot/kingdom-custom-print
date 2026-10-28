import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "kingdom-custom-print",
    entrypoint: "worker.ts",
    compatibilityDate: "2026-10-28",
    compatibilityFlags: ["nodejs_compat"],
    observability: {
      enabled: true,
      redactQueryString: true,
      logs: {
        enabled: true,
        invocationLogs: true,
        headSamplingRate: 1,
        persist: false,
      },
      issues: { enabled: true },
    },
    triggers: [
      triggers.fetch({ pattern: "kingdomcustomprint.com/*", zone: "kingdomcustomprint.com" }),
      triggers.fetch({ pattern: "www.kingdomcustomprint.com/*", zone: "kingdomcustomprint.com" }),
    ],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      VINEXT_KV_CACHE: bindings.kv({ id: "b93c6df2d79f47f8ae6e5b0d560c35bc" }),
      HYPERDRIVE: bindings.hyperdrive({ id: "1df73f5672d24cc79faee05423ca8c2c" }),
    },
  }),
});
