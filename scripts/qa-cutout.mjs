/**
 * Unit checks for the instant, on-device background cutout (lib/imageFx.ts).
 *
 * These are the cases that decide whether "Remove Background" is useful in the
 * real world: a flat backdrop, a gradient backdrop, a photographic vignette, a
 * shadow, artwork that runs off the edge, and a busy photo that must be refused
 * rather than half-removed. No browser, no network, no database.
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

const { cutoutBackground } = load("lib/imageFx.ts", {
  "@/lib/design": { encodeCanvasUnder: () => ({ dataUrl: "", width: 1, height: 1 }) },
});

const W = 420;
const H = 420;
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const blank = () => new Uint8ClampedArray(W * H * 4);

function set(data, x, y, r, g, b, a = 255) {
  const i = (y * W + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
}

/** Hard-edged circle with a single anti-aliased ring, like real artwork. */
function circle(data, cx, cy, rad, r, g, b) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rad - 0.5) set(data, x, y, r, g, b);
      else if (d <= rad + 0.5) {
        const t = rad + 0.5 - d;
        set(data, x, y, Math.round(255 * (1 - t) + r * t), Math.round(255 * (1 - t) + g * t), Math.round(255 * (1 - t) + b * t));
      }
    }
  }
}

function run(name, data, expect) {
  const stats = cutoutBackground({ data, width: W, height: H });
  const alpha = (x, y) => data[(y * W + x) * 4 + 3];
  const detail = `ratio ${stats.ratio.toFixed(3)}, border ${stats.borderClear.toFixed(3)}, corner ${alpha(2, 2)}, centre ${alpha(210, 210)}`;
  check(`${name}: backdrop cleared`, alpha(2, 2) === 0, detail);
  check(`${name}: border fully removed`, stats.borderClear >= expect.borderClear, detail);
  check(`${name}: removed area is the right size`, stats.ratio >= expect.ratio[0] && stats.ratio <= expect.ratio[1], detail);
  if (expect.keepCentre) check(`${name}: subject survives`, alpha(210, 210) > 200, detail);
  return stats;
}

// 1. Flat white backdrop
{
  const data = blank();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(data, x, y, 255, 255, 255);
  circle(data, 210, 210, 130, 192, 57, 43);
  run("flat backdrop", data, { borderClear: 1, ratio: [0.6, 0.8], keepCentre: true });
}

// 2. Linear gradient backdrop — the case that used to come back untouched
{
  const data = blank();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = (x + y) / (W + H - 2);
    set(data, x, y, Math.round(255 - 55 * t), Math.round(255 - 51 * t), Math.round(255 - 45 * t));
  }
  circle(data, 210, 210, 130, 27, 42, 74);
  run("gradient backdrop", data, { borderClear: 1, ratio: [0.6, 0.8], keepCentre: true });
}

// 3. Radial vignette backdrop
{
  const data = blank();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - 210, y - 210);
    const v = Math.round(242 - 100 * Math.min(1, Math.max(0, (d - 40) / 260)));
    set(data, x, y, v, v, v);
  }
  circle(data, 210, 210, 120, 232, 178, 31);
  run("vignette backdrop", data, { borderClear: 1, ratio: [0.6, 0.85], keepCentre: true });
}

// 4. Flat backdrop with a soft drop shadow under the subject
{
  const data = blank();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(data, x, y, 31, 111, 235);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const shade = Math.max(0, 1 - Math.hypot(x - 210, y - 220) / 170) ** 2 * 0.5;
    const i = (y * W + x) * 4;
    data[i] *= 1 - shade;
    data[i + 1] *= 1 - shade;
    data[i + 2] *= 1 - shade;
  }
  circle(data, 210, 200, 120, 255, 212, 0);
  run("backdrop with shadow", data, { borderClear: 1, ratio: [0.6, 0.85], keepCentre: true });
}

// 5. Artwork running off the bottom edge: the backdrop must go, the block must stay
{
  const data = blank();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(data, x, y, 255, 255, 255);
  for (let y = 240; y < H; y++) for (let x = 120; x < 300; x++) set(data, x, y, 200, 40, 40);
  const stats = cutoutBackground({ data, width: W, height: H });
  const alpha = (x, y) => data[(y * W + x) * 4 + 3];
  check("edge artwork: backdrop cleared", alpha(2, 2) === 0);
  check("edge artwork: block survives", alpha(210, 300) === 255 && alpha(200, 410) === 255);
  check("edge artwork: border still mostly backdrop", stats.borderClear >= 0.8, `border ${stats.borderClear.toFixed(3)}`);
}

// 6. Busy photo: there is no backdrop to find, so nothing (and only a little) is cleared
{
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const data = blank();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    set(data, x, y, (60 + rnd() * 150) | 0, (60 + rnd() * 150) | 0, (60 + rnd() * 150) | 0);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (((x - 210) / 120) ** 2 + ((y - 210) / 150) ** 2 <= 1) set(data, x, y, 32, 32, 32);
  }
  const stats = cutoutBackground({ data, width: W, height: H });
  check("busy photo: no backdrop is invented", stats.ratio < 0.05, `ratio ${stats.ratio.toFixed(3)}`);
  check("busy photo: reported as not uniform", stats.borderClear < 0.7, `border ${stats.borderClear.toFixed(3)}`);
}

// 7. White subject on a pale gradient is genuinely ambiguous: the caller refuses it
{
  const data = blank();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = Math.round(250 - 40 * (x / (W - 1)));
    set(data, x, y, v, v, v);
  }
  circle(data, 210, 210, 130, 253, 253, 253);
  const stats = cutoutBackground({ data, width: W, height: H });
  check(
    "pale-on-pale: flagged so it is refused instead of pasted blank",
    stats.ratio >= 0.98,
    `ratio ${stats.ratio.toFixed(3)}`,
  );
}

if (failures > 0) {
  console.log(`${failures} cutout check(s) failed`);
  process.exit(1);
}
console.log("ALL CUTOUT CHECKS PASSED");
