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
    const sql = Object.assign((...args) => Reflect.apply(tx, undefined, args), { begin: (fn) => tx.savepoint(fn) });
    const builder = {};
    const builderCode = ts.transpileModule(fs.readFileSync("lib/homepage-builder.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(builderCode, { exports: builder });
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync("lib/catalog.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require: (name) => { if (name === "./db") return { sql, num: Number }; if (name === "./homepage-builder") return builder; throw new Error(`Unexpected dependency: ${name}`); } });
    const original = await exports.getSettings();
    assert.equal(original.homeProductsTitle, "MAKE IT YOURS");
    const saved = { ...original, homeProductsTitle: "Your team", homeProductsDescription: "Choose a style", homeContactTitle: "Questions?", homeContactDescription: "Get in touch." };
    await exports.saveSettings(saved);
    const read = async () => new Map((await tx`SELECT key, value FROM site_settings`).map(row => [row.key, row.value]));
    const stored = await read();
    assert.equal(stored.get("home_products_title"), "Your team");
    assert.equal(stored.get("home_products_description"), "Choose a style");
    assert.equal(stored.get("home_contact_title"), "Questions?");
    assert.equal(stored.get("home_contact_description"), "Get in touch.");
    assert.equal(stored.get("announcement"), original.announcement);
    const baseline = builder.homepageContentFromSettings(saved);
    await exports.saveSettings({ ...saved, homeContactTitle: "New title" }, baseline);
    await assert.rejects(() => exports.saveSettings(saved, baseline), error => error instanceof exports.HomepageContentConflict);
    assert.equal((await read()).get("home_contact_title"), "New title");
    console.log("PASS: homepage section settings persist without changing other settings");
    console.log("PASS: stale settings cannot overwrite newer homepage content");
    throw rollback;
  });
} catch (error) { if (error !== rollback) throw error; }
finally { await db.end(); }
