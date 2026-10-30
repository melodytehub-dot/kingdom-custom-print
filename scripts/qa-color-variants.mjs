import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const variants = require("../lib/product-variant-manifest.json");
let count = 0;
for (const [product, colors] of Object.entries(variants)) for (const [color, hex] of Object.entries(colors)) {
  assert.match(hex, /^#[0-9a-f]{6}$/);
  for (const suffix of ["", "-back"]) {
    const path = `public/img/printed-catalog/${product}/${color}${suffix}.webp`;
    assert.ok(existsSync(path) && statSync(path).size > 100, `Missing ${path}`);
  }
  count++;
}
console.log(`PASS ${count} catalog colors have front and back images`);

const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto("http://localhost:3000/shop", { waitUntil: "domcontentloaded", timeout: 60000 });
    const card = page.locator(".mm-card").filter({ hasText: "Crown Classic Tee" }).first();
    await card.waitFor();
    await card.locator(".mm-swatch-dot").nth(1).click();
    const selectedName = await card.locator(".mm-swatch-dot.active").getAttribute("title");
    assert.ok(selectedName);
    await page.waitForFunction((name) => {
      const card = [...document.querySelectorAll(".mm-card")].find((item) => item.textContent?.includes("Crown Classic Tee"));
      return card?.querySelector(".mm-card-media img")?.getAttribute("alt")?.includes(name);
    }, selectedName);
    for (const [product, color] of [["crown-classic-tee", "red"], ["classic-pique-polo", "black"], ["premium-pullover-hoodie", "navy"]]) {
      await page.goto(`http://localhost:3000/product/${product}?color=${color}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const main = page.locator(".pdp-photo-stage img");
      await main.waitFor();
      await page.waitForFunction(({ product, color }) => document.querySelector(".pdp-photo-stage img")?.getAttribute("src")?.includes(`/img/printed-catalog/${product}/${color}.webp`), { product, color });
      await page.getByRole("button", { name: "View back" }).click();
      await page.waitForFunction(({ product, color }) => document.querySelector(".pdp-photo-stage img")?.getAttribute("src")?.includes(`/img/printed-catalog/${product}/${color}-back.webp`), { product, color });
      await page.locator(".swatch:not(.is-active)").first().click();
      await page.waitForFunction(({ product, color }) => {
        const container = document.querySelector(".pdp-photo-stage [data-photo-color]");
        const selected = container?.getAttribute("data-photo-color");
        return selected && selected !== color && container.querySelector("img")?.getAttribute("src")?.includes(`/img/printed-catalog/${product}/${selected}-back.webp`);
      }, { product, color });
      await page.goto(`http://localhost:3000/customize/${product}?color=${color}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const image = page.locator("image.rot-shirt-photo");
      await image.waitFor();
      await page.waitForFunction(({ product, color }) => document.querySelector("image.rot-shirt-photo")?.getAttribute("href")?.includes(`/img/printed-catalog/${product}/${color}.webp`), { product, color });
      await page.getByRole("button", { name: viewport.width > 768 ? "Back view" : "Rotate to the back" }).click();
      await page.waitForFunction(({ product, color }) => document.querySelector("image.rot-shirt-photo")?.getAttribute("href")?.includes(`/img/printed-catalog/${product}/${color}-back.webp`), { product, color });
      await page.locator('button.rot-tool[data-tool="products"]').click();
      const alternative = page.locator(`.rot-garment:not([data-color-slug="${color}"])`).first();
      const otherColor = await alternative.getAttribute("data-color-slug");
      assert.ok(otherColor);
      await alternative.click();
      await page.waitForFunction(({ product, otherColor }) => document.querySelector("image.rot-shirt-photo")?.getAttribute("href")?.includes(`/img/printed-catalog/${product}/${otherColor}-back.webp`), { product, otherColor });
    }
    console.log(`PASS product and customizer color views at ${viewport.width}px`);
    await page.close();
  }
} finally { await browser.close(); }
