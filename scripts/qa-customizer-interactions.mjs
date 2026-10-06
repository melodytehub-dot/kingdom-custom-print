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
  useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
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
let selections = [], changes = [], commits = 0;
const props = {
  frontSrc: "front.png", backSrc: "back.png", side: "front", compact: true, renderSize: 200,
  design: { front: [layer, { ...layer, id: "above" }], back: [] }, selectedId: "selected",
  onSelect: id => selections.push(id), onChange: (...args) => changes.push(args),
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
function event(pointerId, x = 100, y = 100) {
  return { pointerId, pointerType: "touch", button: 0, clientX: x, clientY: y,
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
assert.equal(selections.at(-1), layer.id);
assert.equal(slots[1].current, null);
console.log("PASS first mobile tap selects without dragging across a layout resize");

overlays = render();
overlays.at(-1).props.onPointerDown(event(7), layer, "move");
render();
listeners.get("pointermove")(event(8, 120, 120));
assert.equal(changes.length, 0);
listeners.get("pointerup")(event(8));
assert.equal(commits, 0);
listeners.get("pointermove")(event(7, 120, 120));
assert.equal(changes.length, 1);
assert.equal(changes[0][2].x, 75);
assert.equal(changes[0][2].y, 70);
listeners.get("pointerup")(event(7));
assert.equal(commits, 1);
assert.equal(slots[1].current, null);
console.log("PASS only the initiating pointer can move or finish a drag");

overlays = render();
overlays.at(-1).props.onPointerDown(event(9, 120, 120), layer, "scale", "se");
render();
listeners.get("pointermove")(event(9, 140, 140));
const resize = changes.at(-1)[2];
assert.ok(resize.scaleX > 1);
assert.equal(resize.scaleX, resize.scaleY);
listeners.get("pointercancel")(event(9));
assert.equal(slots[1].current, null);
overlays = render();
overlays.at(-1).props.onPointerDown(event(10), { ...layer, locked: true }, "move");
assert.equal(slots[1].current, null);
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
