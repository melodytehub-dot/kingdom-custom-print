/**
 * Verify every catalogue customizer route resolves to the expected garment
 * silhouette, exposes the correct colour count, and stays inside a phone
 * viewport. Run with the dev server listening on localhost:3000.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

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
  ["premium-pullover-hoodie", "hoodie", 8],
  ["heavyweight-crewneck", "crew", 8],
  ["five-panel-cap", "cap", 6],
  ["canvas-tote", "tote", 3],
  ["ceramic-mug", "mug", 3],
];

const generatedFamilies = ["hoodie", "crew", "cap", "mug", "tote"];
for (const family of generatedFamilies) {
  for (const side of ["fr", "bk"]) {
    const asset = path.resolve(`public/img/mockups/families/${family}/WHT_${side}.webp`);
    if (!fs.existsSync(asset)) {
      throw new Error(`Missing generated ${family} ${side} mockup: ${asset}`);
    }
  }
}
console.log(`PASS generated non-tee families — ${generatedFamilies.length} families with front/back assets`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
let failures = 0;

const shopPage = await context.newPage();
try {
  await shopPage.goto(`${BASE}/shop?qa=storefront-images`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  const cards = shopPage.locator(".pcard");
  const cardCount = await cards.count();
  for (let i = 0; i < cardCount; i += 1) {
    await cards.nth(i).scrollIntoViewIfNeeded();
  }
  await shopPage.waitForTimeout(500);
  const broken = await shopPage.locator(".pcard img").evaluateAll((images) =>
    images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.alt || image.src)
  );
  const imagesOk = cardCount > 0 && broken.length === 0;
  console.log(`${imagesOk ? "PASS" : "FAIL"} storefront product images — ${cardCount} cards, ${broken.length} broken`);
  if (!imagesOk) failures += 1;
} catch (error) {
  failures += 1;
  console.log(`FAIL storefront product images ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`);
} finally {
  await shopPage.close();
}

for (const [slug, family, expectedColors] of products) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/customize/${slug}?qa=garment-family`, {
      // Next dev keeps a hot-reload connection open, so networkidle can leave
      // this otherwise deterministic route check waiting indefinitely.
      waitUntil: "domcontentloaded",
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
    const panelPreview = page.locator(".rot-product img").first();
    const renderedColors = new Set();
    for (let colorIndex = 0; colorIndex < colors; colorIndex += 1) {
      await page.locator(".rot-garment").nth(colorIndex).evaluate((button) => button.click());
      await panelPreview.waitFor({ state: "visible", timeout: 5000 });
      const src = await panelPreview.getAttribute("src");
      if (src) renderedColors.add(src);
    }
    const familyOk = family ? href?.includes(`/families/${family}/`) : href?.includes("/img/mockups/garment/");
    const colorsOk = renderedColors.size === colors;
    const ok = Boolean(familyOk) && colors === expectedColors && colorsOk && overflow <= 1;
    console.log(`${ok ? "PASS" : "FAIL"} ${slug} href=${href} colors=${colors}/${expectedColors} renders=${renderedColors.size}/${colors} overflow=${overflow}px`);
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
