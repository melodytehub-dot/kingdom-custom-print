// Local Postgres-compatible server for development and QA.
//
// Runs PGlite (Postgres compiled to WebAssembly) behind a TCP socket so the
// app and its scripts can talk to a real Postgres protocol endpoint without
// touching the production database.
//
//   node scripts/local-db.mjs            # start on 127.0.0.1:55432
//   node scripts/local-db.mjs --reset    # drop the local data directory first
//
// Point DATABASE_URL at it:
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/postgres

import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", ".local-db");
const port = Number(process.env.LOCAL_DB_PORT ?? 55432);

if (process.argv.includes("--reset")) {
  rmSync(dataDir, { recursive: true, force: true });
  console.log(`Removed ${dataDir}`);
}

const db = await PGlite.create({ dataDir });

const existing = await db.query(
  `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`
);
if (existing.rows[0].n === 0) {
  const schema = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");
  await db.exec(schema);
  console.log("Applied db/schema.sql");
}

const server = new PGLiteSocketServer({
  db,
  port,
  host: "127.0.0.1",
  // The app keeps a small connection pool; the server defaults to one socket.
  maxConnections: 20,
});
await server.start();
console.log(`Local Postgres listening on postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);

const shutdown = async () => {
  await server.stop().catch(() => {});
  await db.close().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
