/**
 * Unit checks for the AI mask analyser (lib/cutoutMask.ts).
 *
 * These are the shapes seen in the model lab on real photos: a clean portrait
 * cut-out, a mug whose handle is a legitimate enclosed hole, a model that found
 * nothing (kept 0.6% of the picture — the "it didn't recognise anything"
 * complaint), a model that kept everything, a mask that is a sieve of holes,
 * and a mask with no solid core at all. Only the last three plus "empty" and
 * "everything" may be rejected, because rejecting a good cut-out sends the
 * customer to a slower model for nothing.
 *
 * No browser, no network, no models.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, dependencies, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { filename: file });
  return exports;
}

const { analyseMask, maskIsUsable, polishMask, DEFAULT_MASK_LIMITS } = load("lib/cutoutMask.ts", {});

const W = 400;
const H = 400;
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const blank = () => new Uint8Array(W * H);

/** Fills a rectangle with an alpha value. */
function fill(mask, x0, y0, x1, y1, alpha) {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) mask[y * W + x] = alpha;
  }
}

const report = (mask) => analyseMask(mask, W, H);

/* ---- 1. A portrait: the subject fills the middle, backdrop all around ---- */
const portrait = blank();
fill(portrait, 120, 60, 280, 380, 255);
fill(portrait, 115, 300, 285, 380, 255);
{
  const r = report(portrait);
  // Union of the two rectangles, never counting the overlap twice.
  const body = (280 - 120) * (380 - 60);
  const hem = (285 - 115) * (380 - 300);
  const overlap = (280 - 120) * (380 - 300);
  const coverage = (body + hem - overlap) / (W * H);
  check("portrait silhouette is accepted", maskIsUsable(r), `${r.reject ?? "accept"}, coverage ${r.coverage.toFixed(3)}`);
  check(
    "portrait coverage matches the drawn subject",
    Math.abs(r.coverage - coverage) < 0.002,
    `${r.coverage.toFixed(3)} vs ${coverage.toFixed(3)}`,
  );
  check("portrait has no holes", r.holes === 0);
  check("portrait is solid, not haze", r.solid > 0.2 && r.soft === 0, `solid ${r.solid.toFixed(2)} soft ${r.soft.toFixed(2)}`);
}

/* ---- 2. A mug: a legitimate enclosed hole (the handle) must pass ---- */
const mug = blank();
fill(mug, 100, 120, 300, 300, 255);
fill(mug, 210, 160, 270, 260, 0); // handle hole, enclosed by the body
{
  const r = report(mug);
  check("mug with a handle hole is accepted", maskIsUsable(r), `${r.reject ?? "accept"}, holes ${(100 * r.holes).toFixed(1)}%`);
  check("mug hole is measured, not ignored", r.holes > 0.05, `${(100 * r.holes).toFixed(1)}% of the silhouette`);
}

/* ---- 3. The model found nothing (kept 0.6% of the picture) ---- */
const nothing = blank();
fill(nothing, 0, 0, 12, 8, 255);
{
  const r = report(nothing);
  check("a mask that found nothing is rejected", !maskIsUsable(r) && r.reject === "empty", `${r.reject}, coverage ${r.coverage.toFixed(4)}`);
}

/* ---- 4. The model kept everything (the client's complaint) ---- */
const everything = blank();
fill(everything, 0, 0, W, H, 255);
{
  const r = report(everything);
  check("keeping the whole picture is rejected", !maskIsUsable(r) && r.reject === "everything", `${r.reject}, coverage ${r.coverage.toFixed(3)}`);
}

/* ---- 5. A sieve: half the silhouette punched out ---- */
const sieve = blank();
fill(sieve, 40, 40, 360, 360, 255);
for (let y = 60; y < 340; y += 40) fill(sieve, 60, y, 340, y + 20, 0);
{
  const r = report(sieve);
  check("a sieve of holes is rejected", !maskIsUsable(r) && r.reject === "holes", `${r.reject}, holes ${(100 * r.holes).toFixed(1)}%`);
}

/* ---- 6. Haze: visible but with no solid core ---- */
const haze = blank();
fill(haze, 100, 100, 300, 300, 90);
{
  const r = report(haze);
  check("a mask with no solid core is rejected", !maskIsUsable(r) && r.reject === "mush", `${r.reject}, solid ${r.solid.toFixed(3)}`);
}

/* ---- 7. Soft edges are the point, not a fault ---- */
const hair = blank();
fill(hair, 150, 100, 250, 350, 255);
fill(hair, 140, 100, 150, 350, 120); // a fringe of half-transparent hair
fill(hair, 250, 100, 260, 350, 120);
{
  const r = report(hair);
  check("soft hair edges are accepted", maskIsUsable(r), `${r.reject ?? "accept"}, soft ${r.soft.toFixed(3)}`);
  check("soft edges are reported separately", r.soft > 0.02 && r.solid > r.soft, `soft ${r.soft.toFixed(3)} solid ${r.solid.toFixed(3)}`);
}

/* ---- 8. polishMask: haze goes, hair stays ---- */
{
  const mask = new Uint8Array([0, 4, 9, 10, 11, 90, 255]);
  polishMask(mask);
  check("haze below the threshold is cleared", mask[0] === 0 && mask[1] === 0 && mask[2] === 0, [...mask].join(","));
  check("the boundary value and real edges survive", mask[3] === 10 && mask[4] === 11 && mask[5] === 90 && mask[6] === 255, [...mask].join(","));
}

/* ---- 9. Thresholds are shared with the worker ---- */
check(
  "limits match the calibrated values",
  DEFAULT_MASK_LIMITS.maxHoles === 0.35 && DEFAULT_MASK_LIMITS.minCoverage === 0.01 && DEFAULT_MASK_LIMITS.maxCoverage === 0.97 && DEFAULT_MASK_LIMITS.minSolid === 0.2,
  JSON.stringify(DEFAULT_MASK_LIMITS),
);

/* ---- 10. Degenerate input must not throw ---- */
{
  const empty = analyseMask(new Uint8Array(0), 0, 0);
  check("an empty mask is rejected, not a crash", empty.reject === "empty", empty.reject);
  const small = blank();
  fill(small, 180, 180, 220, 220, 255); // a small logo in a big upload
  const r = report(small);
  check("a small subject is still accepted", maskIsUsable(r), `${r.reject ?? "accept"}, coverage ${r.coverage.toFixed(3)}`);
  const speck = analyseMask(new Uint8Array([0]), 1, 1);
  check("a picture with nothing visible is rejected", speck.reject === "empty", `${speck.reject}, coverage ${speck.coverage}`);
}

if (failures > 0) {
  console.log(`${failures} mask check(s) failed`);
  process.exit(1);
}
console.log("ALL MASK CHECKS PASSED");
