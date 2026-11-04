import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

class FakeImage {
  set src(value) { this.value = value; queueMicrotask(() => this.onload()); }
}
function canvas() {
  const element = { width: 0, height: 0, firstImage: "" };
  const context = {
    drawImage(image) { if (image instanceof FakeImage && !element.firstImage) element.firstImage = image.value; },
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
  };
  element.getContext = () => context;
  return element;
}
const deps = {
  "@/lib/design": {
    printableArea: () => ({ w: 0.4, h: 0.5, cx: 0.5, cy: 0.5 }),
    layerBox: () => ({ w: 20, h: 20 }),
    encodeCanvasUnder: (value) => ({ dataUrl: `data:image/webp,${value.firstImage}` }),
  },
  "./textGeometry": {},
};
const source = fs.readFileSync("components/customizer/preview.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(code, { exports, require: (name) => { if (!deps[name]) throw new Error(`Missing mock: ${name}`); return deps[name]; }, Image: FakeImage, document: { createElement: canvas }, queueMicrotask });
const blank = await exports.drawPreview("front-photo", "back-photo", { front: [], back: [] });
assert.equal(blank.front, "data:image/webp,front-photo");
assert.equal(blank.back, "data:image/webp,back-photo");
const layer = { type: "image", src: "art", x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 };
const designed = await exports.drawPreview("front-photo", "back-photo", { front: [layer], back: [] });
assert.equal(designed.front, "data:image/webp,front-photo");
assert.equal(designed.back, "data:image/webp,back-photo");
console.log("PASS: blank and designed products generate proofs using the selected front and back images");
