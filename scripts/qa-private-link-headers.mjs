import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("worker.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
const deps = {
  "vinext/server/fetch-handler": { default: { fetch: async () => new Response(null, { headers: { "Referrer-Policy": "strict-origin-when-cross-origin" } }) } },
  "./lib/db-context": { runWithDatabaseContext: (_context, fn) => fn(), closeDatabaseContext: async () => {} },
};
vm.runInNewContext(code, { exports, require: (name) => { if (!deps[name]) throw new Error(`Missing mock: ${name}`); return deps[name]; }, URL, Headers, Response, Request, globalThis: {} });
const worker = exports.default;
for (const path of ["/account/verify?token=example", "/account/verify/?token=example", "/quote/example", "/invoice/example"]) {
  const response = await worker.fetch(new Request(`https://example.test${path}`), { HYPERDRIVE: { connectionString: "fixture" } }, {});
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
}
const publicResponse = await worker.fetch(new Request("https://example.test/shop"), { HYPERDRIVE: { connectionString: "fixture" } }, {});
assert.equal(publicResponse.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
console.log("PASS: private links use no-store, no-referrer, and noindex headers");
