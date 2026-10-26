/** Database integration checks for auditable, payment-safe admin transitions. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("Run with --env-file=.env.local");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
const stamp = Date.now().toString(36).toUpperCase();
const pendingRef = `KCP-QAP${stamp}`;
const paidRef = `KCP-QAD${stamp}`;

const transitions = {
  pending: ["cancelled"],
  paid: ["in_proof"],
  in_proof: ["in_production"],
  in_production: ["shipped"],
};

try {
  await sql`INSERT INTO orders (reference, email, name, status) VALUES
    (${pendingRef}, ${"qa-transition@example.test"}, ${"QA pending"}, ${"pending"}),
    (${paidRef}, ${"qa-transition@example.test"}, ${"QA paid"}, ${"paid"})`;
  await sql`UPDATE orders SET paid_at = now(), stripe_payment_intent = 'pi_qa_transition' WHERE reference = ${paidRef}`;

  const exports = {};
  const source = ts.transpileModule(fs.readFileSync("lib/orders.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const deps = {
    "./db": { sql, num: Number },
    "./catalog": {},
    "./pricing": {},
    "./types": { ADMIN_ORDER_TRANSITIONS: transitions },
  };
  vm.runInNewContext(source, { exports, require: name => deps[name] });

  const fakePaid = await exports.updateOrderStatus(pendingRef, "paid");
  assert.equal(fakePaid.ok, false);
  assert.equal(fakePaid.reason, "invalid-transition");
  assert.equal((await sql`SELECT status FROM orders WHERE reference = ${pendingRef}`)[0].status, "pending");
  console.log("PASS admin cannot mark an unpaid order paid");

  assert.equal((await exports.updateOrderStatus(pendingRef, "cancelled")).ok, true);
  assert.equal((await exports.updateOrderStatus(paidRef, "in_proof")).ok, true);
  const events = await sql`
    SELECT actor, from_status, to_status FROM order_status_events
    WHERE order_id IN (SELECT id FROM orders WHERE reference IN (${pendingRef}, ${paidRef}))
    ORDER BY id`;
  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map(event => [event.actor, event.from_status, event.to_status]),
    [["admin", "pending", "cancelled"], ["admin", "paid", "in_proof"]]
  );
  console.log("PASS allowed admin transitions are constrained and written to the audit trail");
} finally {
  await sql`DELETE FROM orders WHERE reference IN (${pendingRef}, ${paidRef})`;
  await sql.end();
}
