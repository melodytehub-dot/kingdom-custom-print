/**
 * Prepares the local development database.
 *
 * The app runs on one SQLite dialect everywhere: Cloudflare D1 in production
 * and Node's built-in SQLite on disk in development. This script resets that
 * local file and seeds the catalog, which is what `db:local` used to do through
 * a Postgres emulator.
 *
 * Run: node scripts/local-db.mjs [--reset]
 */
import { spawnSync } from "node:child_process";

const reset = process.argv.includes("--reset");

const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run("scripts/migrate.mjs", reset ? ["--force"] : []);
run("scripts/seed-sqlite.mjs", reset ? ["--force"] : []);

console.log("Local database ready. Start the app with `npm run dev`.");
