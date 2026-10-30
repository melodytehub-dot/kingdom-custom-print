import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://localhost:3000/customize/heavy-cotton-tee?color=black&sizes=M%3A1", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator("image.rot-shirt-photo").waitFor();
    await page.getByRole("button", { name: /^add text$/i }).first().click();
    await page.locator(".rot-panel .rot-textarea").first().fill("Review image test");
    await page.locator(".rot-panel").getByRole("button", { name: /\+\s*add text/i }).first().click();
    await page.getByRole("button", { name: /^(next|next step)$/i }).first().click();
    await page.locator('input[id^="q-"]').first().waitFor();
    await page.getByRole("button", { name: /^review$/i }).first().click();
    const front = page.locator('.rot-previews img[alt="Front of your design"]');
    const back = page.locator('.rot-previews img[alt="Back of your design"]');
    await front.waitFor();
    await page.waitForFunction(() => document.querySelector('.rot-previews img[alt="Front of your design"]')?.getAttribute("src")?.startsWith("data:image/"));
    async function checkGarment(locator, side) {
      const sample = await locator.evaluate(async image => {
        await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
        const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0, 128, 128);
        const data = ctx.getImageData(0, 0, 128, 128).data;
        let dark = 0; for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 150 && data[i] < 85 && data[i + 1] < 85 && data[i + 2] < 85) dark++;
        return { width: image.naturalWidth, dark };
      });
      assert.ok(sample.width > 0 && sample.dark > 1000, `${side} garment missing: ${JSON.stringify(sample)}`);
    }
    await checkGarment(front, "Review front"); await checkGarment(back, "Review back");
    await page.getByRole("button", { name: /^add to cart$/i }).first().click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("kcp.cart.v1") ?? "[]").length > 0);
    await page.goto("http://localhost:3000/cart", { waitUntil: "domcontentloaded" });
    await checkGarment(page.locator(".cart-thumb img").first(), "Cart preview");
    await page.goto("http://localhost:3000/checkout", { waitUntil: "domcontentloaded" });
    await checkGarment(page.locator(".checkout img[alt*='Heavy Cotton']").first(), "Checkout preview");
    assert.deepEqual(errors, []);
    console.log(`PASS review front/back, cart and checkout show the black garment at ${viewport.width}px`);
    await page.close();
  }
  const fallback = await browser.newPage();
  await fallback.addInitScript(() => localStorage.setItem("kcp.cart.v1", JSON.stringify([{ id: "broken-preview", productSlug: "sample", productName: "Sample", productKind: "tee", colorName: "Black", colorHex: "#101010", lines: [{ label: "M", qty: 1 }], quantity: 1, unitPrice: 10, total: 10, design: { front: [], back: [] }, previewFront: "data:image/png;base64,invalid" }])));
  await fallback.goto("http://localhost:3000/cart", { waitUntil: "domcontentloaded" });
  await fallback.locator('.cart-thumb svg[aria-label="Design preview unavailable"]').waitFor();
  console.log("PASS damaged saved preview displays a garment fallback");
  await fallback.close();
} finally { await browser.close(); }
