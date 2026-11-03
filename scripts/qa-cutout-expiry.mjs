/** Test image expiry against temporary database data; no user images are read. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";
import { NextResponse } from "next/server.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const rollback = new Error("rollback fixture");
try {
  await db.begin(async tx => {
    await tx`CREATE TEMP TABLE cutout_bridge_images (id text PRIMARY KEY, content_type text NOT NULL, bytes bytea NOT NULL, created_at timestamptz NOT NULL) ON COMMIT DROP`;
    await tx`INSERT INTO cutout_bridge_images VALUES (${"a".repeat(32)}, 'image/png', ${Buffer.from([1, 2, 3])}, now()), (${"b".repeat(32)}, 'image/png', ${Buffer.from([4])}, now() - interval '2 days')`;
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync("app/api/cutout-bridge/[id]/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(code, { exports, require: name => name === "next/server" ? { NextResponse } : { sql: tx }, Uint8Array });
    const get = id => exports.GET(new Request("https://example.test"), { params: Promise.resolve({ id }) });
    const current = await get("a".repeat(32));
    assert.equal(current.status, 200);
    assert.equal(current.headers.get("cache-control"), "private, no-store");
    assert.deepEqual([...new Uint8Array(await current.arrayBuffer())], [1, 2, 3]);
    assert.equal((await get("b".repeat(32))).status, 404);
    assert.equal((await get("invalid")).status, 404);
    const workerExports = {};
    let closed = false;
    const workerCode = ts.transpileModule(fs.readFileSync("worker.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    vm.runInNewContext(workerCode, {
      exports: workerExports,
      require: name => name === "./lib/db" ? { sql: tx }
        : name === "./lib/db-context" ? {
          runWithDatabaseContext: (_context, fn) => fn(),
          closeDatabaseContext: async () => { closed = true; },
        } : { default: {} },
    });
    await workerExports.default.scheduled({}, { HYPERDRIVE: { connectionString: "fixture" } });
    const remaining = await tx`SELECT id FROM cutout_bridge_images`;
    assert.deepEqual(remaining.map(row => row.id), ["a".repeat(32)]);
    assert.equal(closed, true);
    console.log("PASS: expired cutout images cannot be fetched and scheduled cleanup deletes only expired images");
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await db.end(); }
