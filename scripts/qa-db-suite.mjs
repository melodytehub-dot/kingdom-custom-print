/** Runs every database-level QA harness in one pass against throwaway SQLite files. */
import { spawnSync } from "node:child_process";

const scripts = [
  "qa-inventory-db",
  "qa-stock-checkout-db",
  "qa-checkout-idempotency",
  "qa-order-transitions",
  "qa-order-payment-replay",
  "qa-invoice-payments-db",
  "qa-admin-quotes-db",
  "qa-quote-snapshot-db",
  "qa-product-inventory-edits",
  "qa-admin-colors",
  "qa-commerce-db",
  "qa-inventory-race",
  "qa-home-settings-db",
  "qa-homepage-layout-db",
  "qa-support-conversation",
  "qa-cutout-expiry",
  "qa-media-gc",
  "qa-builder-db",
  "qa-guest-order-access",
];

let failures = 0;
for (const name of scripts) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, [`scripts/${name}.mjs`], { stdio: "inherit" });
  if (result.status !== 0) failures += 1;
}

console.log(failures ? `\n${failures} harness(es) failed` : `\nall ${scripts.length} database harnesses passed`);
process.exit(failures ? 1 : 0);
