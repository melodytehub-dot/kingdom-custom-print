import postgres from "postgres";

declare global {
  var __kcpSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Add it to .env.local — see .env.example."
    );
  }
  return postgres(url, {
    max: process.env.NODE_ENV === "production" ? 5 : 3,
    ssl: "require",
    idle_timeout: 20,
    connect_timeout: 15,
    // Neon returns numerics as strings to preserve precision; parse them here.
    types: {
      numeric: postgres.BigInt,
    },
    transform: {
      undefined: null,
    },
  });
}

/**
 * Reuse the pool across hot reloads in development so we do not exhaust
 * Neon's connection limit on every code change.
 */
export const sql = globalThis.__kcpSql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__kcpSql = sql;
}

export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}