import { createRequire } from "node:module";
import { getDatabaseContext } from "./db-context";
import {
  createSqlClient,
  type DatabaseLike,
  type PreparedStatementLike,
  type SqlClient,
  type SqlResult,
  type SqlValue,
} from "./sqlite";

declare global {
  var __kcpWorkerDb: DatabaseLike | undefined;
  var __kcpLocalDb: DatabaseLike | undefined;
}

type LocalStatement = {
  all(...params: unknown[]): Record<string, unknown>[];
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): { changes?: number | bigint } | undefined;
};
type LocalDatabase = {
  exec(sql: string): void;
  prepare(sql: string): LocalStatement;
  close(): void;
};
type LocalDatabaseConstructor = new (file: string) => LocalDatabase;

/**
 * Local development driver: Node's built-in SQLite behind the same shape as a
 * Cloudflare D1 binding. Node modules are required lazily so the Worker bundle
 * never evaluates them.
 */
function openLocalDatabase(file: string): DatabaseLike {
  // `createRequire` needs a path rather than an import URL: bundlers rewrite
  // `import.meta.url` for the server build and reject it here.
  const nodeRequire = createRequire(`${process.cwd()}/package.json`);
  const { existsSync, mkdirSync, readFileSync } = nodeRequire("node:fs") as typeof import("node:fs");
  const { dirname, join } = nodeRequire("node:path") as typeof import("node:path");
  const { fileURLToPath } = nodeRequire("node:url") as typeof import("node:url");
  const { DatabaseSync } = nodeRequire("node:sqlite") as { DatabaseSync: LocalDatabaseConstructor };

  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;");
  const ready = db
    .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'products'")
    .get() as { n: number } | undefined;
  if (!ready?.n) {
    const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "schema.sqlite.sql");
    if (!existsSync(schemaPath)) throw new Error(`Local database schema is missing at ${schemaPath}`);
    db.exec(readFileSync(schemaPath, "utf8"));
  }

  const changes = () => {
    const row = db.prepare("SELECT changes() AS n").get() as { n: number } | undefined;
    return Number(row?.n ?? 0);
  };

  const execute = <T>(text: string, values: unknown[]): SqlResult<T> => {
    const results = db.prepare(text).all(...values);
    return { results, meta: { changes: changes() } } as SqlResult<T>;
  };

  const statement = (text: string): PreparedStatementLike => {
    const make = (values: SqlValue[]): PreparedStatementLike => ({
      bind(...more: SqlValue[]) {
        return make([...values, ...more]);
      },
      all: <T>() => execute<T>(text, values),
      run: async () => db.prepare(text).run(...values),
      first: <T>() => (db.prepare(text).get(...values) ?? null) as T | null,
    });
    return make([]);
  };

  // SQLite has one writer, so overlapping batches must queue. D1 gives each
  // batch its own transaction; this keeps local concurrency behaving the same
  // instead of interleaving BEGIN/COMMIT on a single connection.
  let batchQueue = Promise.resolve();

  return {
    prepare: statement,
    close: () => db.close(),
    // SQLite is synchronous locally, so a batch is a plain transaction loop.
    async batch(statements: PreparedStatementLike[]) {
      const run = async () => {
        db.exec("BEGIN IMMEDIATE");
        try {
          const results: SqlResult[] = [];
          for (const item of statements) {
            results.push((await item.all()) as SqlResult);
          }
          db.exec("COMMIT");
          return results;
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      };
      const queued = batchQueue.then(run, run);
      batchQueue = queued.then(
        () => undefined,
        () => undefined
      );
      return queued;
    },
  };
}

function localDatabaseFile(): string {
  return process.env.LOCAL_DB_PATH ?? `${process.cwd()}/.local-db/store.sqlite`;
}

function database(): DatabaseLike {
  const context = getDatabaseContext();
  if (context) return context.db;
  if (globalThis.__kcpWorkerDb) return globalThis.__kcpWorkerDb;
  globalThis.__kcpLocalDb ??= openLocalDatabase(localDatabaseFile());
  return globalThis.__kcpLocalDb;
}

/**
 * Tagged-template SQL client shared by every query module. The database is
 * chosen per request: D1 in the Worker, SQLite on disk in development.
 */
export const sql = new Proxy((() => undefined) as unknown as SqlClient, {
  apply(_target, thisArg, args) {
    const client = createSqlClient(database());
    return Reflect.apply(client as unknown as (...a: unknown[]) => unknown, thisArg, args);
  },
  get(_target, property) {
    const client = createSqlClient(database());
    return Reflect.get(client as object, property, client);
  },
}) as SqlClient;

export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}
