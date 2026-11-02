import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const exports = {};
const code = ts.transpileModule(fs.readFileSync("lib/checkout-attempt.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { exports, Uint8Array });
assert.equal(exports.createCheckoutAttempt({ randomUUID: () => "native-uuid" }), "native-uuid");
const fallback = exports.createCheckoutAttempt({ getRandomValues: (bytes) => { bytes.fill(7); return bytes; } });
assert.match(fallback, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(exports.createCheckoutAttempt(null), null);
const typeExports = {};
const types = ts.transpileModule(fs.readFileSync("lib/types.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(types, { exports: typeExports });
assert.equal(typeExports.describeDesign(undefined), "Design details unavailable");
assert.equal(typeExports.describeDesign({ front: [], back: [] }), "Blank");
console.log("PASS: checkout ID works with native UUID, secure-random fallback, and unavailable crypto");
