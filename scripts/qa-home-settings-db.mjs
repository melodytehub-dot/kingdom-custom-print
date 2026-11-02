import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const rollback = new Error("rollback fixture");
try {
  await db.begin(async (tx) => {
    await tx`CREATE TEMP TABLE site_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz DEFAULT now()) ON COMMIT DROP`;
    const sql = new Proxy(tx, { get(target, property) { return property === "begin" ? (fn) => tx.savepoint(fn) : Reflect.get(target, property); } });
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync("lib/catalog.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require: (name) => { if (name === "./db") return { sql, num: Number }; throw new Error(`Unexpected dependency: ${name}`); } });
    const original = await exports.getSettings();
    assert.equal(original.homeProductsTitle, "MAKE IT YOURS");
    await exports.saveSettings({ ...original, homeProductsTitle: "Your team", homeProductsDescription: "Choose a style", homeContactTitle: "Questions?", homeContactDescription: "Get in touch." });
    const saved = await exports.getSettings();
    assert.equal(saved.homeProductsTitle, "Your team");
    assert.equal(saved.homeProductsDescription, "Choose a style");
    assert.equal(saved.homeContactTitle, "Questions?");
    assert.equal(saved.homeContactDescription, "Get in touch.");
    assert.equal(saved.announcement, original.announcement);
    console.log("PASS: homepage section settings persist without changing other settings");
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await db.end(); }
