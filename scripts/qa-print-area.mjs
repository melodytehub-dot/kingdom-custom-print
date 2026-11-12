import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/design.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const result = {};
vm.runInNewContext(code, { exports: result, require: () => ({}) });
const configured = { frontW: 0.8, frontH: 0.8, backW: 0.8, backH: 0.8 };
for (const [kind, side, left, right, top, bottom] of [
  ["hoodie", "front", 0.30, 0.82, 0.22, 0.60],
  ["hoodie", "back", 0.20, 0.72, 0.18, 0.72],
  ["crew", "front", 0.28, 0.78, 0.20, 0.74],
  ["crew", "back", 0.23, 0.75, 0.20, 0.74],
  ["tote", "front", 0.30, 0.91, 0.40, 0.99],
  ["tote", "back", 0.09, 0.70, 0.40, 0.99],
]) {
  const area = result.printableArea(side, configured, kind);
  assert.ok(area.cx - area.w / 2 >= left && area.cx + area.w / 2 <= right, `${kind} ${side} horizontal placement`);
  assert.ok(area.cy - area.h / 2 >= top && area.cy + area.h / 2 <= bottom, `${kind} ${side} vertical placement`);
}
const narrow = result.printableArea("front", { ...configured, frontW: 0.2 }, "hoodie");
assert.equal(narrow.w, 0.2, "smaller configured print widths remain respected");
for (const [slug, kind, side, left, right, top, bottom] of [
  ["crown-classic-tee", "tee", "back", .29, .71, .25, .75],
  ["long-sleeve-tee", "longsleeve", "front", .30, .74, .20, .75],
  ["long-sleeve-tee", "longsleeve", "back", .25, .67, .20, .75],
  ["v-neck-tee", "tee", "front", .35, .65, .30, .70],
  ["v-neck-tee", "tee", "back", .35, .65, .25, .75],
  ["womens-fitted-tee", "tee", "back", .29, .65, .25, .75],
]) {
  const area = result.printableArea(side, configured, kind, slug);
  assert.ok(area.cx - area.w / 2 >= left && area.cx + area.w / 2 <= right, `${slug} ${side} horizontal placement`);
  assert.ok(area.cy - area.h / 2 >= top && area.cy + area.h / 2 <= bottom, `${slug} ${side} vertical placement`);
}
console.log("PASS: print guides stay on audited garment mockups");
