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
    assert.ok(fit.ty >= 12);
    assert.ok(fit.ty + fit.size <= height - 12);
    assert.equal(fit.left + fit.size / 2, width / 2);
    if (!(width <= 900 && height > width)) {
      assert.ok(fit.left >= 12);
      assert.ok(fit.left + fit.size <= width - 12);
    }
    assert.equal(fitStage(width, height, 1.12).size, fit.size * 1.12);
  }
}
assert.equal(fitStage(390, 632).size, 546);
assert.equal(fitStage(320, 356).size, 332);
assert.equal(fitStage(844, 390).size, 366);
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
let selections = [], changes = [], taps = [], commits = 0, ungroups = [];
const props = {
  frontSrc: "front.png", backSrc: "back.png", side: "front", compact: true, renderSize: 200,
  design: { front: [layer, { ...layer, id: "above" }], back: [] }, selectedIds: ["selected"],
  onSelect: ids => selections.push(ids), onChange: (...args) => changes.push(args),
  onTap: id => taps.push(id),
  onCommit: () => commits++, onDelete() {}, onEdit() {}, onUngroup: ids => ungroups.push(ids),
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
const controlLabels = controls.map(node => node.props["aria-label"]);
assert.ok(controlLabels.includes("Resize"), `selection exposes a resize target (got: ${controlLabels.join(", ")})`);
const resizeControl = controls.find(node => node.props["aria-label"] === "Resize");
const scale = Number(resizeControl.props.transform.match(/scale\(([^)]+)\)/)[1]);
assert.ok(Math.abs(68 * scale * 200 / 900 - 44) < .001);
console.log("PASS selected hit area is topmost; mobile exposes a 44px resize target");

overlays = render({ selectedIds: [] });
overlays[0].props.onPointerDown(event(1), layer, "move");
assert.equal(selections.length, 0);
assert.equal(taps.length, 0);
render({ selectedIds: [] });
listeners.get("pointermove")(event(1, 103, 102));
assert.equal(changes.length, 0);
listeners.get("pointerup")(event(1, 103, 102));
assert.equal(taps.at(-1), layer.id);
assert.equal(slots[1].current, null);
assert.equal(commits, 0);
console.log("PASS mobile tap opens editor only on release; small finger motion does not drag");

overlays = render({ selectedIds: [] });
overlays.at(-1).props.onPointerDown(event(7), layer, "move");
render({ selectedIds: [] });
listeners.get("pointermove")(event(8, 120, 120));
assert.equal(changes.length, 0);
listeners.get("pointerup")(event(8));
assert.equal(commits, 0);
listeners.get("pointermove")(event(7, 120, 120));
assert.deepEqual([...selections.at(-1)], [layer.id]);
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

/* ---- grouping: several layers that behave as one object ---- */
const grpA = { ...layer, id: "a", groupId: "grp", x: 30, y: 40 };
const grpB = { ...layer, id: "b", groupId: "grp", x: 70, y: 60 };
const loneC = { ...layer, id: "c", x: 10, y: 10 };
const groupDesign = { front: [grpA, grpB, loneC], back: [] };
const stage900 = () => {
  slots[0].current = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 900 }) };
};

selections = []; changes = []; taps = []; commits = 0;
overlays = render({ design: groupDesign, selectedIds: [] });
overlays.find(o => o.props.layer.id === "a").props.onPointerDown(event(20), grpA, "move");
render({ design: groupDesign, selectedIds: [] });
listeners.get("pointermove")(event(20, 110, 110));
assert.deepEqual([...selections.at(-1)], ["a", "b"], "grabbing a grouped element selects the whole group");
assert.deepEqual(changes.map(c => c[1]), ["a", "b"], "both members of the group move together");
assert.deepEqual([changes[0][2].x, changes[0][2].y], [42.5, 50]);
assert.deepEqual([changes[1][2].x, changes[1][2].y], [82.5, 70]);
listeners.get("pointerup")(event(20, 110, 110));
assert.equal(commits, 1);
assert.equal(taps.length, 0, "dragging a group never opens an editor");
console.log("PASS dragging one grouped element carries the whole group");

selections = []; changes = []; taps = []; commits = 0;
overlays = render({ design: groupDesign, selectedIds: ["a", "b"], compact: false });
const groupNodes = nodes(overlays);
assert.ok(groupNodes.some(n => n.props?.["data-group-frame"]), "a multi-selection draws one group frame");
assert.ok(groupNodes.some(n => n.props?.["data-group-hit"]), "the group has a grab area over empty space");
const groupLabels = groupNodes.filter(n => n.props?.role === "button").map(n => n.props["aria-label"]);
for (const label of ["Ungroup", "Resize group", "Rotate group"]) {
  assert.ok(groupLabels.includes(label), `group frame offers ${label} (got: ${groupLabels.join(", ")})`);
}
assert.ok(!groupLabels.some(l => l === "Edit artwork"), "a group has no single-element edit button");

const rotate = groupNodes.find(n => n.props?.["aria-label"] === "Rotate group");
stage900();
rotate.props.onPointerDown(event(21, 550, 423));
render({ design: groupDesign, selectedIds: ["a", "b"], compact: false });
listeners.get("pointermove")(event(21, 450, 523));
const turned = changes.filter(c => c[2].rotation !== undefined);
assert.equal(turned.length, 2, "rotating a group turns every member");
assert.deepEqual(turned.map(c => c[2].rotation), [90, 90]);
assert.equal(turned[0][2].x + turned[1][2].x, 100, "members stay balanced about the group centre");
assert.equal(turned[0][2].y + turned[1][2].y, 100);
listeners.get("pointerup")(event(21, 450, 523));

changes = [];
const groupResize = nodes(render({ design: groupDesign, selectedIds: ["a", "b"], compact: false }))
  .find(n => n.props?.["aria-label"] === "Resize group");
stage900();
groupResize.props.onPointerDown(event(22, 572, 498));
render({ design: groupDesign, selectedIds: ["a", "b"], compact: false });
listeners.get("pointermove")(event(22, 700, 600));
const scaled = changes.filter(c => c[2].scaleX !== undefined);
assert.equal(scaled.length, 2, "resizing a group scales every member");
assert.ok(scaled.every(c => c[2].scaleX > 1 && c[2].scaleX === c[2].scaleY), "group resize stays proportional");
assert.ok(scaled.every(c => c[2].x > 0), "members follow the group box");
listeners.get("pointerup")(event(22, 700, 600));

const ungroup = nodes(render({ design: groupDesign, selectedIds: ["a", "b"], compact: false }))
  .find(n => n.props?.["aria-label"] === "Ungroup");
ungroup.props.onPointerDown({ preventDefault() {}, stopPropagation() {} });
assert.deepEqual([...ungroups.at(-1)], ["a", "b"]);
console.log("PASS group frame resizes and rotates as one, and offers ungroup");

cleanups.forEach(fn => fn?.());

const { TextIdeasPanel } = load("components/customizer/panels.tsx", {
  react, "react/jsx-runtime": jsx,
  "next/link": {}, "next/image": {},
  "@/lib/design": { newTextLayer: values => ({ type: "text", ...values }) },
  "@/lib/sizes": {}, "@/lib/pricing": {}, "@/lib/mockups": {}, "@/lib/fonts": {},
  "./art": {}, "./editors": { PanelHeader: () => null }, "./templates": {},
  "./icons": { CheckGlyph: () => null },
});
slots = []; cursor = 0;
let added;
const textProps = { side: "front", onClose() {}, onAdd: layers => { added = layers; } };
let textNodes = nodes(TextIdeasPanel(textProps));
assert.equal(textNodes.find(node => node.type === "button").props.disabled, true);
textNodes.find(node => node.type === "textarea").props.onChange({ target: { value: 'Vintage "Kings United"' } });
cursor = 0;
textNodes = nodes(TextIdeasPanel(textProps));
textNodes.find(node => node.type === "button").props.onClick();
assert.equal(added.length, 2);
assert.ok(added.every(layer => layer.type === "text"));
assert.equal(added[0].text, "KINGS UNITED");
console.log("PASS local Text Ideas disables empty prompts and adds editable lettering");

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
  "react/jsx-runtime": jsx, "next/link": {}, "next/image": {}, "next/navigation": { useRouter: () => ({ push() {} }) }, "../ProductPhotography": {},
  "./DesignCanvas": { default: Canvas, printAreaView: () => ({ w: 360, h: 450, x: 90, y: 100 }) }, "./stageGeometry": { fitStage },
  "./panels": { NN_DEFAULTS: {}, LayersPanel: () => null }, "./editors": {}, "./icons": {}, "./art": { ART_LIBRARY: [] },
  "@/lib/design": {
    emptyDesign: blank, usedSides: () => [], personalizationOf: () => "none", loadDrafts: () => [], removeLayers: d => d, selectionIsWholeGroup: () => false, selectionIds: (d, s, id) => [id], groupMembers: () => [],
    newTextLayer: () => ({ ...layer, type: "text" }),
  },
  "@/lib/imageFx": {
    DEFAULT_FX: {},
    artworkProfile: async () => ({ texture: 0, flat: 1, edges: 0 }),
    isFlatArtwork: () => false,
    isVectorSource: () => false,
    quickBackgroundRemoval: async () => null,
    applyImageFx: async (_src, fx) => ({ dataUrl: "", aspect: 1, fx }),
  },
  "@/lib/backgroundRemoval": {
    removeBackgroundLocally: async () => ({ dataUrl: "", source: "portrait", report: {} }),
    CutoutError: class CutoutError extends Error { constructor(reason, message) { super(message); this.reason = reason; } },
  },
  "@/lib/cutoutActions": load("lib/cutoutActions.ts", { "@/lib/cutoutModels": { formatModelSize: () => "6 MB" } }),
  "@/lib/cutoutModels": {
    CUTOUT_MAX_EDGE: 1400, DETAILED_PLAN: ["general"], cutoutPlan: () => ["portrait"], formatModelSize: () => "6 MB",
  },
  "./preview": {},
  "@/lib/mockups": { mockupsForProduct: () => [mockup], TEE_MOCKUPS: [mockup] },
  "@/lib/cart-context": { useCart: () => ({ items: [], addItem() {} }) },
  "@/lib/pricing": { quoteProduct: () => ({}), formatUSD: value => `$${value}` },
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
function tool(root, id) {
  const rail = rawNodes(root).find(node => node.props?.className === "rot-rail");
  return rail.props.children.find(button => button.props["data-tool"] === id);
}
for (const [id, label] of [["text", "Add Text"], ["products", "Product"], ["art", "Add Graphics"], ["ideas", "Text Ideas"], ["saved", "Saved Designs"], ["distress", "Distress"], ["names", "Names & Numbers"]]) {
  let root = renderStudio();
  const button = tool(root, id);
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
tool(root, "text").props.onClick();
root = renderStudio();
rawNodes(root).find(node => node.props?.onAdd && node.props?.onClose).props.onAdd({});
root = renderStudio();
tool(root, "art").props.onClick();
root = renderStudio();
let canvas = rawNodes(root).find(node => node.props?.onTap && node.props?.onSelect);
canvas.props.onSelect([]);
assert.equal(renderStudio().props["data-layout"], "none");
root = renderStudio();
canvas = rawNodes(root).find(node => node.props?.onTap && node.props?.onSelect);
canvas.props.onSelect([layer.id]);
assert.equal(renderStudio().props["data-layout"], "none");
root = renderStudio();
canvas = rawNodes(root).find(node => node.props?.onTap && node.props?.onSelect);
canvas.props.onTap(layer.id);
assert.equal(renderStudio().props["data-layout"], "split");
console.log("PASS design panels dismiss outside, remain usable inside, and drag selection never opens an editor");
