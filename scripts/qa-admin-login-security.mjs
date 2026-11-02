import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let same = true, allowed = true, fails = false, created = 0;
const NextResponse = { json(body, options = {}) { return { body, status: options.status ?? 200, cookies: { values: [], set(...value) { this.values.push(value); } } }; } };
const deps = {
  "next/server": { NextResponse },
  "@/lib/admin-auth": { ADMIN_COOKIE: "kcp_admin", adminConfigured: () => true, passwordMatches: (value) => value === "correct", pruneSessions: async () => {}, createSession: async () => { created++; return "fixture-token"; } },
  "@/lib/customer-auth": { sameOrigin: () => same, authAttemptAllowed: async () => { if (fails) throw new Error("database unavailable"); return allowed; } },
  "@/lib/limited-form-data": { limitedJson: (request) => request.json() },
};
const exports = {};
const code = ts.transpileModule(fs.readFileSync("app/api/admin/login/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(code, { exports, process: { env: { NODE_ENV: "production" } }, require: (name) => { assert.ok(name in deps, name); return deps[name]; } });
const request = (password) => new Request("https://example.test/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
same = false; assert.equal((await exports.POST(request("correct"))).status, 403); same = true;
allowed = false; assert.equal((await exports.POST(request("correct"))).status, 429); allowed = true;
fails = true; assert.equal((await exports.POST(request("correct"))).status, 503); fails = false;
assert.equal((await exports.POST(request("wrong"))).status, 401); assert.equal(created, 0);
const success = await exports.POST(request("correct")); assert.equal(success.status, 200); assert.equal(created, 1);
assert.equal(success.cookies.values[0][2].httpOnly, true); assert.equal(success.cookies.values[0][2].secure, true);
console.log("PASS: admin login rejects cross-origin and rate-limited requests, fails closed, and sets a secure cookie");
