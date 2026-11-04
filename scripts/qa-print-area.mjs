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
assert.equal(result.printableArea("front", configured, "tee").w, 0.8, "other product guides remain unchanged");
console.log("PASS: front and back print guides stay on hoodie, sweatshirt and tote mockups");
