/**
 * Verify every catalogue customizer route resolves to the expected garment
 * silhouette, exposes the correct colour count, and stays inside a phone
 * viewport. Run with the dev server listening on localhost:3000.
 */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const products = [
  ["crown-classic-tee", null, 14],
  ["heavy-cotton-tee", null, 14],
  ["softstyle-tee", null, 14],
  ["comfort-colors-tee", null, 10],
  ["tri-blend-tee", null, 8],
  ["ultra-cotton-tee", null, 14],
  ["cvc-tee", null, 8],
  ["performance-tee", null, 8],
  ["pocket-tee", "pocket", 10],
  ["heather-cvc-tee", null, 8],
  ["womens-fitted-tee", "fitted", 8],
  ["youth-classic-tee", "youth", 14],
  ["v-neck-tee", "vneck", 6],
  ["long-sleeve-tee", "longsleeve", 6],
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
let failures = 0;

for (const [slug, family, expectedColors] of products) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/customize/${slug}?qa=garment-family`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    const photo = page.locator("image.rot-shirt-photo").first();
    await photo.waitFor({ state: "attached", timeout: 15000 });
    const href = await photo.getAttribute("href");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const productsButton = page.locator("button.rot-tool").filter({ hasText: "Products" }).first();
    await productsButton.evaluate((button) => button.click());
    await page.locator(".rot-garment").first().waitFor({ state: "attached", timeout: 5000 });
    const colors = await page.locator(".rot-garment").count();
    const familyOk = family ? href?.includes(`/families/${family}/`) : href?.includes("/img/mockups/garment/");
    const ok = Boolean(familyOk) && colors === expectedColors && overflow <= 1;
    console.log(`${ok ? "PASS" : "FAIL"} ${slug} href=${href} colors=${colors}/${expectedColors} overflow=${overflow}px`);
    if (!ok) failures += 1;
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${slug} ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(failures ? `${failures} garment route checks failed` : "ALL GARMENT ROUTE CHECKS PASSED");
process.exit(failures ? 1 : 0);
