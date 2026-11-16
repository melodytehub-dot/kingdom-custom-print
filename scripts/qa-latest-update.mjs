/**
 * Storefront regression for the polo range on a phone: category entry, shop
 * cards, product gallery and studio colour switching.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.QA_BASE ?? "http://localhost:3100";
const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('.mm-nav-link[href="/shop?kind=polo"]').first().waitFor({ state: "attached" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  console.log("PASS polo navigation on the phone homepage");

  await page.goto(`${base}/shop?kind=tee`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".mm-card").first().waitFor();
  await page.locator(".mm-card-media img").first().waitFor({ state: "attached" });
  console.log("PASS tee cards render product photos");

  await page.goto(`${base}/shop?kind=polo`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".mm-card").first().waitFor();
  assert.match(await page.locator(".mm-card-title").first().innerText(), /polo/i);
  await page.locator(".mm-card-media img").first().evaluate((image) => image.decode());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  console.log("PASS polo shop card and phone layout");

  await page.goto(`${base}/product/classic-pique-polo`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator(".pdp-thumbs li").first().waitFor();
  assert.equal(await page.locator(".pdp-thumbs li").count(), 2);
  await page.getByRole("button", { name: "View back", exact: true }).click();
  assert.equal(await page.locator(".pdp-photo-stage .product-photography").getAttribute("data-photo-view"), "back");
  console.log("PASS polo product gallery has accurate front and back views");

  await page.goto(`${base}/customize/classic-pique-polo`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const photo = page.locator(".rot-product-preview image").first();
  await photo.waitFor({ state: "attached", timeout: 20000 });
  assert.match(await photo.getAttribute("href"), /\/img\/printed-catalog\/classic-pique-polo\/white\.webp/);

  await page.locator('button.rot-tool[data-tool="products"]').evaluate((button) => button.click());
  const swatch = page.locator('.rot-garment[data-color-slug="black"]');
  await swatch.waitFor({ state: "attached", timeout: 10000 });
  await swatch.evaluate((button) => button.click());
  await page.waitForFunction(() => {
    const image = document.querySelector(".rot-product-preview image");
    const label = document.querySelector(".rot-product-color")?.textContent?.trim();
    return image?.getAttribute("href")?.includes("/classic-pique-polo/black.webp")
      && new URL(location.href).searchParams.get("color") === "black"
      && label?.includes("Black");
  }, undefined, { timeout: 10000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  console.log("PASS polo colour switching and phone layout in the design studio");

  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
