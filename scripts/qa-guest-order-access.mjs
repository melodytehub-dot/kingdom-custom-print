/** Exercise guest access using transaction-scoped temporary tables only. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import postgres from "postgres";
import ts from "typescript";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const rollback = new Error("rollback fixture");
try {
  await db.begin(async (tx) => {
    await tx`CREATE TEMP TABLE orders (id int PRIMARY KEY, reference text, email text) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE order_access_sessions (token_hash text, order_id int, expires_at timestamptz) ON COMMIT DROP`;
    await tx`INSERT INTO orders VALUES (1, 'KCP-AAAAAA', 'buyer@example.test'), (2, 'KCP-BBBBBB', 'other@example.test')`;
    tx.begin = async fn => fn(tx);
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync("lib/order-access.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const deps = { "node:crypto": crypto, "next/headers": { cookies: async () => ({ get: () => undefined }) }, "./db": { sql: tx }, "./customer-auth": { normalizedEmail: value => value.trim().toLowerCase() } };
    vm.runInNewContext(source, { exports, require: name => deps[name], process, Date });
    assert.equal(await exports.verifyGuestOrder("KCP-AAAAAA", "wrong@example.test"), null);
    const token = await exports.verifyGuestOrder("KCP-AAAAAA", "BUYER@example.test");
    assert.ok(token);
    assert.equal(await exports.guestCanAccessOrder("KCP-AAAAAA", token), true);
    assert.equal(await exports.guestCanAccessOrder("KCP-BBBBBB", token), false);
    assert.equal(await exports.guestCanAccessOrder("KCP-AAAAAA", "invalid"), false);
    await tx`UPDATE order_access_sessions SET expires_at = now() - interval '1 second'`;
    assert.equal(await exports.guestCanAccessOrder("KCP-AAAAAA", token), false);
    console.log("PASS: guest access requires the order email, is limited to one order, and expires");
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await db.end(); }
