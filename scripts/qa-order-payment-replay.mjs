/** Database integration check, rolled back in full after verification. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";
if (!process.env.DATABASE_URL) throw new Error("Run with --env-file=.env.local");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
const rollback = new Error("QA transaction rollback");
try {
  await sql.begin(async tx => {
    const reference = `KCP-QA${Date.now().toString(36).toUpperCase()}`;
    const session = `cs_test_qa_${Date.now()}`;
    await tx`INSERT INTO orders (reference, email, name, stripe_session_id, status) VALUES (${reference}, ${"qa-replay@example.com"}, ${"Temporary QA fixture"}, ${session}, ${"pending"})`;
    const exports = {};
    const deps = { "./db": { sql: tx, num: Number }, "./catalog": {}, "./pricing": {} };
    const source = ts.transpileModule(fs.readFileSync("lib/orders.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(source, { exports, require: name => deps[name] });
    await exports.markOrderPaid(session, "pi_test_fixture");
    const [paid] = await tx`SELECT status, paid_at FROM orders WHERE reference = ${reference}`;
    assert.equal(paid.status, "paid");
    assert.ok(paid.paid_at);
    await tx`UPDATE orders SET status = ${"shipped"} WHERE reference = ${reference}`;
    await exports.markOrderPaid(session, "pi_test_fixture");
    const [replayed] = await tx`SELECT status, paid_at FROM orders WHERE reference = ${reference}`;
    assert.equal(replayed.status, "shipped");
    assert.equal(replayed.paid_at.getTime(), paid.paid_at.getTime());
    console.log("PASS verified payment marks pending order paid; repeated event preserves shipped status and original paid timestamp");
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
  console.log("PASS temporary payment fixture rolled back; no test order persists");
} finally { await sql.end(); }
