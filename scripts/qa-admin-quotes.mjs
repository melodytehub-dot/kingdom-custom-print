import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const code = ts.transpileModule(fs.readFileSync("lib/admin-quotes.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, { exports });
const valid = { name: "Customer", email: "buyer@example.com", notes: "", lines: [{ description: "Printed shirts", quantity: 12, unitCents: 1250 }], shippingCents: 695 };
assert.equal(exports.validateQuote(valid).value.lines[0].unitCents, 1250);
assert.ok(exports.validateQuote({ ...valid, lines: [{ ...valid.lines[0], unitCents: null }] }).error);
assert.ok(exports.validateQuote({ ...valid, lines: [{ ...valid.lines[0], quantity: 1.5 }] }).error);
assert.ok(exports.validateQuote({ ...valid, shippingCents: -1 }).error);
assert.ok(exports.validateQuote({ ...valid, email: "invalid" }).error);
assert.ok(exports.validateQuote({ ...valid, lines: [] }).error);
console.log("PASS: quote details and currency amounts are validated");
