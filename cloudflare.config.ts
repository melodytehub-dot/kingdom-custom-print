import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "kingdom-custom-print",
    entrypoint: "worker.ts",
    compatibilityDate: "2026-10-28",
    compatibilityFlags: ["nodejs_compat"],
    observability: {
      issues: { enabled: true },
    },
    triggers: [
      triggers.scheduled({ schedule: "0 * * * *" }),
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
      DB: bindings.d1({ id: "d40d9352-2ef1-416c-8948-8a6601113c30", name: "kingdom-custom-print" }),
      SUPPORT_INBOUND_DOMAIN: bindings.text("untuulunue.resend.app"),
    },
  }),
});
