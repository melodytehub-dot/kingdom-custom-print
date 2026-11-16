/**
 * Applies the SQLite schema to the local development database.
 *
 * Production uses Cloudflare D1; apply the same file with:
 *   npx wrangler d1 execute kingdom-custom-print --remote --file=db/schema.sqlite.sql
 *
 * Run: node scripts/migrate.mjs [--force]
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const force = process.argv.includes("--force");
const file = process.env.LOCAL_DB_PATH ?? join(process.cwd(), ".local-db", "store.sqlite");
const schemaPath = join(process.cwd(), "db", "schema.sqlite.sql");
const schema = readFileSync(schemaPath, "utf8");

mkdirSync(dirname(file), { recursive: true });
if (force) {
  console.log(`Removing ${file}`);
  try {
    rmSync(file, { force: true });
    rmSync(`${file}-wal`, { force: true });
    rmSync(`${file}-shm`, { force: true });
  } catch {
    console.error(`Could not remove ${file}. Stop the dev server, then run this again.`);
    process.exit(1);
  }
}

const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(schema);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((row) => row.name);

console.log(`Schema applied to ${file}. Tables: ${tables.join(", ")}`);
db.close();
