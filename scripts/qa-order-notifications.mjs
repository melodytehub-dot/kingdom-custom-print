import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const receipts = new Set();
const notifications = new Set();
const sends = [];
let failBusiness = true;
const sql = async (parts, ...values) => {
  const query = parts.join("?");
  const store = query.includes("order_business_notifications") ? notifications : receipts;
  if (query.includes("SELECT")) return store.has(values[0]) ? [{ reference: values[0] }] : [];
  if (query.includes("INSERT")) { store.add(values[0]); return []; }
  throw new Error("Unexpected query");
};
const sendEmail = async message => {
  sends.push(message.idempotencyKey);
  if (message.idempotencyKey.startsWith("order-business/") && failBusiness) throw new Error("temporary delivery failure");
  return "fixture-provider-id";
};
const exports = {};
const source = ts.transpileModule(fs.readFileSync("lib/order-email.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const dependencies = { "./db": { sql }, "./email": { sendEmail }, "./orders": { getOrderByReference: async reference => ({ reference, status: "paid", name: "Test", email: "buyer@example.test", total: 12, items: [] }) } };
vm.runInNewContext(source, { exports, require: name => dependencies[name], process: { env: { SUPPORT_EMAIL: "owner@example.test" } } });
await assert.rejects(exports.sendPaidOrderReceipt("KCP-TEST"));
failBusiness = false;
await exports.sendPaidOrderReceipt("KCP-TEST");
await exports.sendPaidOrderReceipt("KCP-TEST");
assert.deepEqual(sends, ["order-receipt/KCP-TEST", "order-business/KCP-TEST", "order-business/KCP-TEST"]);
console.log("PASS: business notification retries without resending an already-recorded customer receipt");
