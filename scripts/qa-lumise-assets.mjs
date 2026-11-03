import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const fonts = {};
const requested = [];
const document = { createElement: () => ({}), fonts: { load: async () => [] }, head: { append: link => { requested.push(link.href); link.onload(); } } };
const source = ts.transpileModule(fs.readFileSync("lib/fonts.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(source, { exports: fonts, document });
const knownFonts = new Set(fonts.FONTS.map(font => font.value));
const cliparts = JSON.parse(fs.readFileSync("public/lumise/cliparts.json", "utf8"));
const templates = JSON.parse(fs.readFileSync("public/lumise/templates.json", "utf8"));
const missing = [], unknownFonts = [], unorderable = [];
const artworkPath = /^\/lumise\/(?:cliparts|template-elements|templates)\/(?:[a-z0-9_ -]+\/)*[a-z0-9_. -]+\.(?:svg|png|jpe?g|webp)$/i;
function checkAsset(path) {
  if (typeof path !== "string" || !path.startsWith("/") || !fs.existsSync(`public${decodeURIComponent(path)}`)) missing.push(path);
}
for (const art of cliparts.items) {
  checkAsset(art.src);
  if (art.src.includes("..") || !artworkPath.test(art.src)) unorderable.push(art.src);
}
for (const template of templates.items) {
  checkAsset(template.previewSrc);
  if ((template.elements ?? []).length > 30) unorderable.push(`${template.id}: too many layers`);
  for (const element of template.elements ?? []) {
    if (element.layer?.src) {
      checkAsset(element.layer.src);
      if (element.layer.src.includes("..") || !artworkPath.test(element.layer.src)) unorderable.push(element.layer.src);
    }
    if (element.type === "text" && !knownFonts.has(element.layer?.font)) unknownFonts.push(`${template.id}: ${element.layer?.font}`);
  }
}
assert.deepEqual(missing, [], `Missing library assets: ${missing.slice(0, 10).join(", ")}`);
assert.deepEqual(unknownFonts, [], `Unknown template fonts: ${unknownFonts.slice(0, 10).join(", ")}`);
assert.deepEqual(unorderable, [], `Checkout-incompatible library assets: ${unorderable.slice(0, 10).join(", ")}`);
for (const value of ["google-comfortaa", "google-quicksand", "google-architects-daughter", "google-oxygen", "google-special-elite"]) {
  await fonts.ensureFontLoaded(value);
}
assert.equal(requested.length, 5);
assert.ok(requested.every(url => url.startsWith("https://fonts.googleapis.com/css2?family=")));
console.log(`PASS: assets and text fonts resolve for ${cliparts.items.length} clipart items and ${templates.items.length} templates`);
