/**
 * Shared setup for the database QA scripts.
 *
 * Each run builds a throwaway SQLite file from `db/schema.sqlite.sql` and the
 * catalog seed, points the app at it through `LOCAL_DB_PATH`, and loads the real
 * modules with Vite so the checks exercise the same code as the storefront.
 */
import { createServer } from "vite";
import nodeAsyncHooks from "node:async_hooks";
import nodeModule from "node:module";
import nodeCrypto from "node:crypto";
import nodeFs from "node:fs";
import nodePath from "node:path";
import nodeUrl from "node:url";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

// Vite's module runner loads source files without Node's builtin globals, so
// expose them before the app modules import.
for (const [key, value] of Object.entries({ ...nodeAsyncHooks, ...nodeModule, ...nodeCrypto, ...nodeFs, ...nodePath, ...nodeUrl })) {
  globalThis[key] ??= value;
}

const SCHEMA = "db/schema.sqlite.sql";
const SEED = "db/seed.sql";

let counter = 0;

/**
 * Build a seeded, disposable database and a module loader bound to it.
 * Pass `{ seed: false }` for an empty catalog.
 */
export async function createHarness({ seed = true, name = "qa" } = {}) {
  mkdirSync(".local-db", { recursive: true });
  const target = `.local-db/${name}-${process.pid}-${counter++}.sqlite`;
  rmSync(target, { force: true });

  const db = new DatabaseSync(target);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(SCHEMA, "utf8"));
  if (seed) db.exec(readFileSync(SEED, "utf8"));

  // `lib/db.ts` reads the path on first use, so set it before loading modules.
  process.env.LOCAL_DB_PATH = target;
  delete globalThis.__kcpLocalDb;

  const server = await createServer({
    configFile: false,
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
    resolve: {
      alias: {
        "@": nodePath.resolve(process.cwd()),
        // Next marks server-only modules with this package; it is not installed
        // as a dependency, so the QA loader supplies a no-op stand-in.
        "server-only": nodePath.resolve("scripts/qa-server-only.mjs"),
        "next/cache": nodePath.resolve("scripts/qa-next-cache.mjs"),
      },
    },
  });

  const load = (path) => server.ssrLoadModule(path);

  const all = (text, ...params) => db.prepare(text).all(...params);
  const one = (text, ...params) => db.prepare(text).get(...params);
  const run = (text, ...params) => db.prepare(text).run(...params);

  return {
    target,
    db,
    load,
    all,
    one,
    run,
    async close() {
      await server.close();
      try {
        globalThis.__kcpLocalDb?.close?.();
      } catch {
        // The app may already have closed its connection.
      }
      db.close();
      rmSync(target, { force: true });
      rmSync(`${target}-wal`, { force: true });
      rmSync(`${target}-shm`, { force: true });
    },
  };
}

/** A product variant from the seeded catalog, used by order and stock checks. */
export function seededVariant(db, slug = "crown-classic-tee") {
  const row = db
    .prepare(
      `SELECT p.id AS product_id, p.name AS product_name, p.kind, p.sale_mode,
              c.name AS color_name, c.hex AS color_hex, s.label AS size_label
       FROM products p
       JOIN product_colors c ON c.product_id = p.id
       JOIN product_sizes s ON s.product_id = p.id
       WHERE p.slug = ?
       LIMIT 1`
    )
    .get(slug);
  if (!row) throw new Error(`No seeded variant for ${slug}`);
  return row;
}

/** Stock helpers so a test can set and read a variant's count. */
export function setStock(db, variant, quantity) {
  db.prepare(
    `INSERT INTO inventory_stock (product_id, color_name, size_label, quantity)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (product_id, color_name, size_label) DO UPDATE SET quantity = excluded.quantity`
  ).run(variant.product_id, variant.color_name, variant.size_label, quantity);
}

export function stockCount(db, variant) {
  return db
    .prepare("SELECT quantity FROM inventory_stock WHERE product_id = ? AND color_name = ? AND size_label = ?")
    .get(variant.product_id, variant.color_name, variant.size_label)?.quantity ?? 0;
}

export function enableInventory(db, enabled = true) {
  db.prepare("UPDATE inventory_control SET enabled = ? WHERE id = 1").run(enabled ? 1 : 0);
}
