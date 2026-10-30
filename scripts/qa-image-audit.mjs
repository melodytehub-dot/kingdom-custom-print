import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const variants = require("../lib/product-variant-manifest.json");
const base = process.env.QA_BASE ?? "http://localhost:3000";
const routes = ["/", "/shop", "/customize", "/about", "/contact", "/wishlist", ...Object.keys(variants).map(slug => `/product/${slug}`)];
const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
const issues = [];
try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 60000 });
      if (!response?.ok()) { issues.push(`${route}: HTTP ${response?.status()}`); continue; }
      await page.evaluate(() => document.querySelectorAll("img").forEach(image => { image.loading = "eager"; }));
      const broken = await page.locator("img").evaluateAll(async images => {
        await Promise.all(images.map(image => Promise.race([image.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 5000))])));
        return images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.currentSrc || image.src || image.alt);
      });
      for (const src of broken) issues.push(`${route}: ${src}`);
    } catch (error) { issues.push(`${route}: ${error.message.split("\n")[0]}`); }
    finally { await page.close(); }
  }
} finally { await browser.close(); }
for (const issue of issues) console.log(`FAIL ${issue}`);
assert.equal(issues.length, 0, `${issues.length} broken page images`);
console.log(`PASS image loading across ${routes.length} storefront and product pages`);
