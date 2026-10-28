import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const BROWSER = process.env.QA_BROWSER ?? "chrome";

const cliparts = JSON.parse(readFileSync("public/lumise/cliparts.json", "utf8"));
const templates = JSON.parse(readFileSync("public/lumise/templates.json", "utf8"));
assert.equal(cliparts.items.length, 3322);
assert.equal(templates.items.length, 311);
console.log("PASS Lumise manifests contain 3,322 cliparts and 311 templates");

const browser = await chromium.launch({ channel: BROWSER, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(`${BASE}/customize/v-neck-tee?qa=lumise`, { waitUntil: "commit", timeout: 30000 });
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 60000 });
  const tool = (id) => page.locator(`button.rot-tool[data-tool="${id}"]`).first();

  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/lumise/templates.json") && response.ok()),
    tool("templates").evaluate((button) => button.click()),
  ]);
  await page.waitForFunction(() => document.querySelectorAll("select[aria-label='Template category'] option").length > 9);
  await page.getByRole("searchbox", { name: "Search templates" }).fill("Harambe");
  const harambe = page.getByRole("button", { name: "Use Harambe template" });
  await harambe.waitFor({ state: "visible" });
  await harambe.click();
  await page.locator('image[href*="/lumise/templates/"]').waitFor({ state: "attached" });
  console.log("PASS a migrated Lumise template can be searched and added on mobile");

  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/lumise/cliparts.json") && response.ok()),
    tool("art").evaluate((button) => button.click()),
  ]);
  await page.waitForFunction(() => document.querySelectorAll("select[aria-label='Artwork category'] option").length > 6);
  await page.getByRole("searchbox", { name: "Search artwork" }).fill("angel8");
  const angel = page.getByRole("button", { name: "angel8", exact: true });
  await angel.waitFor({ state: "visible" });
  await angel.click();
  await page.locator('image[href*="/lumise/cliparts/"]').waitFor({ state: "attached" });
  console.log("PASS a migrated Lumise clipart can be searched and added on mobile");

  assert.deepEqual(errors, []);
  console.log("PASS Lumise library runs without page errors");
} finally {
  await browser.close();
}
