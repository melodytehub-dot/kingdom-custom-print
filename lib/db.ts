import postgres from "postgres";
import { getDatabaseContext } from "./db-context";

declare global {
  var __kcpSql: ReturnType<typeof postgres> | undefined;
}

function createClient(url: string, isWorkerRequest = false) {
  return postgres(url, {
    max: isWorkerRequest ? 5 : process.env.NODE_ENV === "production" ? 5 : 3,
    ssl: "require",
    idle_timeout: 20,
    connect_timeout: 15,
    ...(isWorkerRequest ? { fetch_types: false } : {}),
    // Neon returns numerics as strings to preserve precision; parse them here.
    types: {
      numeric: postgres.BigInt,
    },
    transform: {
      undefined: null,
    },
  });
}

function getClient() {
  const context = getDatabaseContext();
  if (context) {
    context.client ??= createClient(context.connectionString, true);
    return context.client;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Add it to .env.local — see .env.example."
    );
  }
  globalThis.__kcpSql ??= createClient(url);
  return globalThis.__kcpSql;
}

/**
 * Reuse the pool across hot reloads in development so we do not exhaust
 * Neon's connection limit on every code change.
 */
export const sql = new Proxy((() => undefined) as unknown as ReturnType<typeof postgres>, {
  apply(_target, thisArg, args: Parameters<ReturnType<typeof postgres>>) {
    return Reflect.apply(getClient(), thisArg, args);
  },
  get(_target, property) {
    const client = getClient();
    return Reflect.get(client, property, client);
  },
}) as ReturnType<typeof postgres>;

export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}
