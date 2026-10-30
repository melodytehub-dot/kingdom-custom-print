/** Grouping model regressions: groupId tags, pruning, grouping, and duplication. No browser. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, dependencies) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } }, { filename: file });
  return exports;
}

const {
  duplicateSelection,
  groupMembers,
  groupPeers,
  groupSelection,
  normalizeLayer,
  pruneGroups,
  removeLayer,
  removeLayers,
  selectionIds,
  selectionIsWholeGroup,
  ungroupSelection,
} = load("lib/design.ts", {
  "@/components/customizer/textGeometry": { measureTextLayer: () => ({ w: 100, h: 50 }) },
  "./heic": { convertHeicUpload: async (file) => file },
  "./imageFormat": {
    detectImageFormat: async () => null,
    formatLabel: (format) => String(format ?? "image"),
  },
});

const image = (id, extra = {}) => ({
  id, type: "image", src: `${id}.png`, name: id, aspect: 1,
  x: 50, y: 50, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, flipH: false, flipV: false,
  ...extra,
});

const a = image("a", { groupId: "grp", x: 30, y: 40 });
const b = image("b", { groupId: "grp", x: 70, y: 60 });
const c = image("c", { x: 10, y: 10 });
const design = { front: [a, b, c], back: [] };
const ids = (list) => [...list].map((entry) => (typeof entry === "string" ? entry : entry.id));

/* ---- reading a group ---- */
assert.deepEqual(ids(groupMembers(design, "front", "grp")), ["a", "b"]);
assert.deepEqual(ids(groupPeers(design, "front", "a")), ["a", "b"]);
assert.deepEqual(ids(groupPeers(design, "front", "c")), ["c"]);
assert.deepEqual(ids(selectionIds(design, "front", "b")), ["a", "b"]);
assert.deepEqual(ids(selectionIds(design, "front", "c")), ["c"]);
assert.equal(groupPeers(design, "front", "missing").length, 0);
assert.equal(selectionIsWholeGroup(design, "front", ["a", "b"]), true);
assert.equal(selectionIsWholeGroup(design, "front", ["a"]), false);
assert.equal(selectionIsWholeGroup(design, "front", ["a", "b", "c"]), false);
assert.equal(selectionIsWholeGroup(design, "front", ["c"]), false);
console.log("PASS groups are read as one selection and a lone layer stays alone");

/* ---- a group of one is not a group ---- */
const orphan = image("d", { groupId: "solo" });
assert.equal(normalizeLayer(orphan).groupId, "solo");
assert.equal(normalizeLayer(image("e", { groupId: "" })).groupId, undefined);
assert.deepEqual([...pruneGroups([orphan, c])].map((l) => l.groupId), [undefined, undefined]);
assert.deepEqual([...pruneGroups([a, b])].map((l) => l.groupId), ["grp", "grp"]);
console.log("PASS blank and orphaned group tags are dropped");

/* ---- grouping and ungrouping ---- */
const merged = groupSelection(design, "front", ["c", "a"]);
const mergedA = merged.front.find((l) => l.id === "a");
const mergedB = merged.front.find((l) => l.id === "b");
const mergedC = merged.front.find((l) => l.id === "c");
assert.ok(mergedA.groupId && mergedA.groupId === mergedC.groupId, "the picked layers share a new group");
assert.equal(mergedB.groupId, undefined, "leaving a group prunes the stragglers");
assert.notEqual(mergedA.groupId, "grp", "grouping mints a fresh id");
assert.equal(groupSelection(design, "front", ["a"]).front, design.front, "one layer cannot be grouped");

const split = ungroupSelection(design, "front", ["a"]);
assert.equal(split.front.find((l) => l.id === "a").groupId, undefined);
assert.equal(split.front.find((l) => l.id === "b").groupId, undefined, "the leftover member is freed too");
assert.equal(ungroupSelection(design, "front", ["c"]), design, "ungrouping an ungrouped layer is a no-op");
console.log("PASS grouping merges picks and ungrouping frees the leftovers");

/* ---- deletions and duplication keep groups honest ---- */
assert.equal(removeLayer(design, "front", "a").front.find((l) => l.id === "b").groupId, undefined);
assert.equal(removeLayer(design, "front", "c").front.find((l) => l.id === "a").groupId, "grp");
assert.deepEqual(ids(removeLayers(design, "front", ["a", "b"]).front), ["c"]);

const copy = duplicateSelection(design, "front", ["a", "b"]);
assert.ok(copy, "a group can be duplicated");
assert.equal(copy.design.front.length, 5, "both members are copied");
assert.deepEqual(ids(copy.ids).length, 2);
const copies = copy.design.front.slice(2, 4);
assert.ok(copies.every((l) => l.groupId && l.groupId === copies[0].groupId), "the copies form one new group");
assert.notEqual(copies[0].groupId, "grp");
assert.ok(copies.every((l) => !["a", "b", "c"].includes(l.id)), "copies get fresh ids");
assert.deepEqual([...copies].map((l) => [l.x, l.y]), [[35, 45], [75, 65]], "copies step off the originals");
assert.equal(copy.design.front[4].id, "c", "copies land directly above their originals");
assert.equal(duplicateSelection(design, "front", []), null);
console.log("PASS deleting prunes groups and duplicating copies the whole group");

const single = duplicateSelection(design, "front", ["c"]);
assert.equal(single.design.front.length, 4);
assert.equal(single.design.front[2].groupId, undefined, "a duplicated lone layer stays lone");
console.log("PASS a duplicated lone layer is not put into a group");
