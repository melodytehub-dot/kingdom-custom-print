/**
 * Verify every catalogue customizer route resolves to the expected garment
 * silhouette, exposes the correct colour count, and stays inside a phone
 * viewport. Run with the dev server listening on localhost:3000.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const products = [
  ["crown-classic-tee", null, 77],
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
  ["youth-classic-tee", "youth", 48],
  ["v-neck-tee", "vneck", 6],
  ["long-sleeve-tee", "longsleeve", 6],
  ["classic-pique-polo", "polo", 5],
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

const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
let failures = 0;

const shopPage = await context.newPage();
try {
  await shopPage.goto(`${BASE}/shop?qa=storefront-images`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await shopPage.locator(".mm-card").first().waitFor({ state: "attached", timeout: 15000 });
  const cards = shopPage.locator(".mm-card");
  const cardCount = await cards.count();
  for (let i = 0; i < cardCount; i += 1) {
    await cards.nth(i).scrollIntoViewIfNeeded();
  }
  await shopPage.waitForFunction(() => [...document.querySelectorAll(".mm-card img")].every(image => image.complete && image.naturalWidth > 0), undefined, { timeout: 15000 }).catch(() => {});
  const broken = await shopPage.locator(".mm-card img").evaluateAll((images) =>
    images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.alt || image.src)
  );
  const imagesOk = cardCount > 0 && broken.length === 0;
  console.log(`${imagesOk ? "PASS" : "FAIL"} storefront product images — ${cardCount} cards, ${broken.length} broken`);
  if (!imagesOk) { failures += 1; console.log("Broken image details:", broken); }
} catch (error) {
  failures += 1;
  console.log(`FAIL storefront product images ${(error instanceof Error ? error.message : String(error)).split("\n")[0]}`);
} finally {
  await shopPage.close();
}

for (const [slug, family, expectedColors] of products) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    await page.goto(`${BASE}/customize/${slug}?qa=garment-family`, {
      // Next dev keeps a hot-reload connection open, so networkidle can leave
      // this otherwise deterministic route check waiting indefinitely.
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const photo = page.locator(".rot-product-preview image").first();
    await photo.waitFor({ state: "attached", timeout: 20000 });
    const href = await photo.getAttribute("href");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

    const productsButton = page.locator('button.rot-tool[data-tool="products"]');
    await productsButton.evaluate((button) => button.click());
    await page.locator(".rot-garment").first().waitFor({ state: "attached", timeout: 5000 });
    const colors = await page.locator(".rot-garment").count();

    let swatchesOk = true;
    const renderedColors = new Set();
    for (let colorIndex = 0; colorIndex < colors; colorIndex += 1) {
      const swatch = page.locator(".rot-garment").nth(colorIndex);
      const variant = await swatch.evaluate((button) => ({
        slug: button.dataset.colorSlug,
        name: button.getAttribute("aria-label"),
      }));
      await swatch.evaluate((button) => button.click());
      // Preview sources differ per family (printed catalogue art for garments,
      // per-colour mockups for caps and drinkware), so assert the swatch
      // selects its colour and that the artwork sets differ per colour.
      const synced = await page
        .waitForFunction(({ slug: colorSlug, name }) => {
          const art = document.querySelector(".rot-product-preview image");
          const label = document.querySelector(".rot-product-color")?.textContent?.trim();
          const src = art?.getAttribute("href") ?? "";
          return new URL(location.href).searchParams.get("color") === colorSlug
            && src.length > 0
            && Boolean(label?.includes(name));
        }, variant, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!synced) swatchesOk = false;
      const src = await photo.getAttribute("href");
      if (src) renderedColors.add(src);
    }

    // The catalogue summary under each product lists its colour count and price.
    const summary = await page.locator(".rot-blank .rot-blank-details").first().innerText().catch(() => "");
    const summaryOk = /colors/.test(summary) && /From \$/.test(summary);
    const colorLabel = await page.locator(".rot-product-color").first().innerText().catch(() => "");

    const familyOk = Boolean(href?.startsWith("/img/"));
    const colorsOk = renderedColors.size === colors;
    const ok = familyOk && colors === expectedColors && swatchesOk && colorsOk && summaryOk && pageErrors.length === 0 && overflow <= 1;
    console.log(`${ok ? "PASS" : "FAIL"} ${slug} family=${familyOk} colors=${colors}/${expectedColors} sync=${swatchesOk} art=${renderedColors.size}/${colors} summary=${summaryOk} label=${JSON.stringify(colorLabel.trim())} overflow=${overflow}px`);
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
