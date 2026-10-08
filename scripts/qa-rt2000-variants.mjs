import assert from "node:assert/strict";
import { RT2000_COLORS, RT2000B_COLORS } from "./rt2000-colors.mjs";

for (const [style, colors, expected] of [
  ["RT2000", RT2000_COLORS, 77],
  ["RT2000B", RT2000B_COLORS, 48],
]) {
  assert.equal(colors.length, expected, `${style} color count`);
  assert.equal(new Set(colors.map((color) => color.slug)).size, expected, `${style} unique slugs`);
  assert.equal(new Set(colors.map((color) => color.name)).size, expected, `${style} unique names`);
  assert.ok(colors.every((color) => /^#[\da-f]{6}$/i.test(color.hex)), `${style} valid hex swatches`);
  console.log(`PASS ${style}: ${colors.length} catalog colors with unique names/slugs and valid swatches`);
}
