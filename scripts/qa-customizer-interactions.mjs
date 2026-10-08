/** Isolated component/geometry regressions. No browser, network, or database. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";

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

const { fitStage } = load("components/customizer/stageGeometry.ts", {});
for (const width of [320, 375, 390, 430, 768, 901, 1440]) {
  for (const height of [130, 180, 260, 500, 800]) {
    const fit = fitStage(width, height);
    assert.ok(fit.size > 0);
    assert.ok(fit.left >= 12 && fit.ty >= 12);
    assert.ok(fit.left + fit.size <= width - 12);
    assert.ok(fit.ty + fit.size <= height - 12);
    assert.equal(fitStage(width, height, 1.12).size, fit.size * 1.12);
  }
}
assert.equal(fitStage(0, 500).size, 0);
assert.equal(fitStage(320, 0).size, 0);
console.log("PASS stage fits both dimensions across 35 mobile/desktop stage sizes");

let cursor = 0;
let slots = [];
let effects = [];
let cleanups = [];
const listeners = new Map();
const react = {
  useId: () => "test",
  useMemo: fn => fn(),
  useCallback: fn => fn,
  useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
  useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }]; },
  useEffect(fn) { effects.push(fn); },
};
const { default: Canvas } = load("components/customizer/DesignCanvas.tsx", {
  react, "react/jsx-runtime": jsx,
  "@/lib/design": { areaFor: area => area, teeArea: () => ({ w: .4, h: .5, cx: .5, cy: .47 }), layerBox: () => ({ w: 100, h: 60 }) },
  "@/lib/fonts": { svgFontStack: () => "sans-serif" },
  "./textGeometry": {},
}, { window: {
  addEventListener: (name, fn) => listeners.set(name, fn),
  removeEventListener: name => listeners.delete(name),
} });

const layer = { id: "selected", type: "image", src: "test.png", x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1 };
let selections = [], changes = [], taps = [], commits = 0;
const props = {
  frontSrc: "front.png", backSrc: "back.png", side: "front", compact: true, renderSize: 200,
  design: { front: [layer, { ...layer, id: "above" }], back: [] }, selectedId: "selected",
  onSelect: id => selections.push(id), onChange: (...args) => changes.push(args),
  onTap: id => taps.push(id),
  onCommit: () => commits++, onDelete() {}, onEdit() {},
};
function render(overrides = {}) {
  cleanups.forEach(fn => fn?.());
  effects = []; cursor = 0;
  const tree = Canvas({ ...props, ...overrides });
  slots[0].current = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }) };
  cleanups = effects.map(fn => fn());
  const svg = tree.props.children;
  return svg.props.children.at(-1).props.children;
}
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node.type === "function") return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}
function event(pointerId, x = 100, y = 100, type = "pointerup") {
  return { type, pointerId, pointerType: "touch", button: 0, clientX: x, clientY: y,
    preventDefault() {}, stopPropagation() {}, currentTarget: { setPointerCapture() {} } };
}

let overlays = render();
assert.equal(overlays.at(-1).props.layer.id, "selected");
const controls = nodes(overlays.at(-1)).filter(node => node.props?.role === "button");
assert.deepEqual(controls.map(node => node.props["aria-label"]), ["Resize"]);
const scale = Number(controls[0].props.transform.match(/scale\(([^)]+)\)/)[1]);
assert.ok(Math.abs(68 * scale * 200 / 900 - 44) < .001);
console.log("PASS selected hit area is topmost; mobile exposes one 44px resize target");

overlays = render({ selectedId: null });
overlays[0].props.onPointerDown(event(1), layer, "move");
assert.equal(selections.length, 0);
assert.equal(taps.length, 0);
render({ selectedId: null });
listeners.get("pointermove")(event(1, 103, 102));
assert.equal(changes.length, 0);
listeners.get("pointerup")(event(1, 103, 102));
assert.equal(taps.at(-1), layer.id);
assert.equal(slots[1].current, null);
assert.equal(commits, 0);
console.log("PASS mobile tap opens editor only on release; small finger motion does not drag");

overlays = render({ selectedId: null });
overlays.at(-1).props.onPointerDown(event(7), layer, "move");
render({ selectedId: null });
listeners.get("pointermove")(event(8, 120, 120));
assert.equal(changes.length, 0);
listeners.get("pointerup")(event(8));
assert.equal(commits, 0);
listeners.get("pointermove")(event(7, 120, 120));
assert.equal(selections.at(-1), layer.id);
assert.equal(changes.length, 1);
assert.equal(changes[0][2].x, 75);
assert.equal(changes[0][2].y, 70);
listeners.get("pointerup")(event(7, 120, 120));
assert.equal(commits, 1);
assert.equal(taps.length, 1);
assert.equal(slots[1].current, null);
console.log("PASS first gesture drags an unselected layer without opening editor; second pointer is ignored");

overlays = render();
overlays.at(-1).props.onPointerDown(event(9, 120, 120), layer, "scale", "se");
render();
listeners.get("pointermove")(event(9, 140, 140));
const resize = changes.at(-1)[2];
assert.ok(resize.scaleX > 1);
assert.equal(resize.scaleX, resize.scaleY);
listeners.get("pointercancel")(event(9, 140, 140, "pointercancel"));
assert.equal(slots[1].current, null);
overlays = render();
overlays.at(-1).props.onPointerDown(event(10), { ...layer, locked: true }, "move");
render();
const beforeLockedMove = changes.length;
listeners.get("pointermove")(event(10, 130, 130));
assert.equal(changes.length, beforeLockedMove);
listeners.get("pointerup")(event(10, 130, 130));
assert.equal(slots[1].current, null);
assert.equal(taps.length, 1);
overlays = render();
overlays.at(-1).props.onPointerDown(event(11), layer, "move");
render();
listeners.get("pointercancel")(event(11, 100, 100, "pointercancel"));
assert.equal(taps.length, 1);
console.log("PASS proportional resize, pointer cancellation, and locked-layer movement guard");
cleanups.forEach(fn => fn?.());

const { AiTextPanel } = load("components/customizer/panels.tsx", {
  react, "react/jsx-runtime": jsx,
  "next/link": {}, "next/image": {},
  "@/lib/design": { newTextLayer: values => ({ type: "text", ...values }) },
  "@/lib/sizes": {}, "@/lib/pricing": {}, "@/lib/mockups": {}, "@/lib/fonts": {},
  "./art": {}, "./editors": { PanelHeader: () => null },
  "./icons": { CheckGlyph: () => null },
});
slots = []; cursor = 0;
let generated;
const textProps = { side: "front", onClose() {}, onGenerate: layers => { generated = layers; } };
let textNodes = nodes(AiTextPanel(textProps));
assert.equal(textNodes.find(node => node.type === "button").props.disabled, true);
textNodes.find(node => node.type === "textarea").props.onChange({ target: { value: 'Vintage "Kings United"' } });
cursor = 0;
textNodes = nodes(AiTextPanel(textProps));
textNodes.find(node => node.type === "button").props.onClick();
assert.equal(generated.length, 2);
assert.ok(generated.every(layer => layer.type === "text"));
assert.equal(generated[0].text, "KINGS UNITED");
console.log("PASS text helper disables empty prompts and generates lettering only");

class PanelTarget {
  constructor(region) { this.region = region; }
  closest(selectors) { return selectors.split(", ").includes(this.region) ? this : null; }
}
const blank = () => ({ front: [], back: [] });
const mockup = { code: "black", slug: "black", name: "Black", hex: "#111111", front: "front.png", back: "back.png" };
const { default: Customizer } = load("components/customizer/Customizer.tsx", {
  react: { ...react, useState(initial) {
    return react.useState(initial?.w === 0 && initial?.h === 0 ? { w: 400, h: 500 } : initial);
  } },
  "react/jsx-runtime": jsx, "next/link": {}, "next/image": {}, "../ProductPhotography": {},
  "./DesignCanvas": { default: Canvas }, "./stageGeometry": { fitStage },
  "./panels": { NN_DEFAULTS: {} }, "./editors": {}, "./icons": {}, "./art": { ART_LIBRARY: [] },
  "@/lib/design": {
    emptyDesign: blank, usedSides: () => [], personalizationOf: () => "none", loadDrafts: () => [],
    newTextLayer: () => ({ ...layer, type: "text" }),
  },
  "@/lib/imageFx": {}, "./preview": {},
  "@/lib/mockups": { mockupsForProduct: () => [mockup], TEE_MOCKUPS: [mockup] },
  "@/lib/cart-context": { useCart: () => ({ items: [], addItem() {} }) },
  "@/lib/pricing": { quoteProduct: () => ({}) },
}, { Element: PanelTarget });
function rawNodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(rawNodes);
  return [node, ...rawNodes(node.props?.children)];
}
slots = [];
const studioProduct = { id: 1, slug: "tee", name: "Tee", sizes: [{ label: "M" }], colors: [] };
function renderStudio() {
  cursor = 0; effects = [];
  return Customizer({ product: studioProduct, products: [studioProduct], initialColor: "black", initialLines: {}, contactPhone: "" });
}
function tool(root, label) {
  const rail = rawNodes(root).find(node => node.props?.className === "rot-rail");
  return rail.props.children.find(button => button.props.children[1].props.children === label);
}
for (const label of ["Add Text", "Products", "Add Art", "Text Ideas", "Saved", "Distress", "Personalize"]) {
  let root = renderStudio();
  const button = tool(root, label);
  assert.ok(button, `${label} tool exists`);
  button.props.onClick();
  root = renderStudio();
  assert.notEqual(root.props["data-layout"], "none", `${label} opens`);
  root.props.onPointerDownCapture({ target: new PanelTarget(".rot-panel") });
  root = renderStudio();
  assert.notEqual(root.props["data-layout"], "none", `${label} stays open for panel controls`);
  root.props.onPointerDownCapture({ target: new PanelTarget(".rot-rail") });
  root = renderStudio();
  assert.notEqual(root.props["data-layout"], "none", `${label} allows tool switching`);
  root.props.onPointerDownCapture({ target: new PanelTarget(".rot-bar") });
  assert.equal(renderStudio().props["data-layout"], "none", `${label} dismisses on outside tap`);
}
let root = renderStudio();
tool(root, "Add Text").props.onClick();
root = renderStudio();
rawNodes(root).find(node => node.props?.onAdd && node.props?.onClose).props.onAdd({});
root = renderStudio();
tool(root, "Add Art").props.onClick();
root = renderStudio();
let canvas = rawNodes(root).find(node => node.props?.onTap && node.props?.onSelect);
canvas.props.onSelect(null);
assert.equal(renderStudio().props["data-layout"], "none");
root = renderStudio();
canvas = rawNodes(root).find(node => node.props?.onTap && node.props?.onSelect);
canvas.props.onSelect(layer.id);
assert.equal(renderStudio().props["data-layout"], "none");
root = renderStudio();
canvas = rawNodes(root).find(node => node.props?.onTap && node.props?.onSelect);
canvas.props.onTap(layer.id);
assert.equal(renderStudio().props["data-layout"], "split");
console.log("PASS design panels dismiss outside, remain usable inside, and drag selection never opens an editor");
