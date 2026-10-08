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
      const swatch = page.locator(".rot-garment").nth(colorIndex);
      const variant = await swatch.evaluate((button) => {
        const rgb = getComputedStyle(button.querySelector("span")).backgroundColor.match(/\d+/g).map(Number);
        return {
          slug: button.dataset.colorSlug,
          name: button.getAttribute("aria-label"),
          hex: rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase(),
        };
      });
      await swatch.evaluate((button) => button.click());
      await page.waitForFunction(({ slug, hex, name }) => {
        const photo = document.querySelector("image.rot-shirt-photo");
        const preview = document.querySelector(".rot-product img");
        const tile = document.querySelector(".rot-blank.is-active img");
        const label = document.querySelector(".rot-product-color")?.textContent?.trim();
        return new URL(location.href).searchParams.get("color") === slug
          && new URL(photo.getAttribute("href"), location.href).searchParams.get("color")?.toUpperCase() === hex
          && preview?.getAttribute("src") === photo.getAttribute("href")
          && tile?.getAttribute("src") === preview?.getAttribute("src")
          && label?.includes(name);
      }, variant);
      await panelPreview.waitFor({ state: "visible", timeout: 5000 });
      const src = await panelPreview.getAttribute("src");
      if (src) renderedColors.add(src);
    }
    const front = await photo.getAttribute("href");
    await page.getByRole("button", { name: "Back view", exact: true }).click();
    const back = await photo.getAttribute("href");
    await page.getByRole("button", { name: "Front view", exact: true }).click();
    const selected = page.locator(".rot-blank.is-active .rot-blank-details");
    const catalogDetails = await selected.innerText();
    const familyOk = href?.includes(`/api/garment-preview?family=${family ?? "tee"}&`);
    const colorsOk = renderedColors.size === colors;
    const viewsOk = front?.includes("view=front") && back?.includes("view=back");
    const detailsOk = Boolean(catalogDetails.match(/\S+\s+·/) && catalogDetails.match(/\d+ colors/) && catalogDetails.match(/(?:Adult|Youth)/) && catalogDetails.match(/From \$\d/));
    const ok = Boolean(familyOk) && colors === expectedColors && colorsOk && viewsOk && detailsOk && overflow <= 1;
    console.log(`${ok ? "PASS" : "FAIL"} ${slug} family=${Boolean(familyOk)} colors=${colors}/${expectedColors} renders=${renderedColors.size}/${colors} sync=pass front/back=${Boolean(viewsOk)} details=${Boolean(detailsOk)} overflow=${overflow}px`);
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
