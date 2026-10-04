/**
 * Customer-facing customizer interaction smoke test.
 * Covers the controls most likely to regress during visual work: garment colour
 * swapping, text editing, font scrolling, and the free local AI assistant.
 */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text());
});

try {
  await page.goto(`${BASE}/customize/v-neck-tee?qa=controls`, {
    // Wait for the response commit; the dev server may keep the document's
    // load lifecycle open while compiling the customizer and its image assets.
    waitUntil: "commit",
    timeout: 30000,
  });
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 15000 });

  const photo = page.locator("image.rot-shirt-photo").first();
  const products = page.locator("button.rot-tool").filter({ hasText: "Products" }).first();
  await products.evaluate((button) => button.click());
  await page.locator(".rot-garment").nth(1).waitFor({ state: "visible", timeout: 5000 });
  const swatches = page.locator(".rot-garment");
  const swatchCount = await swatches.count();
  const productPreview = page.locator(".rot-product img").first();
  const beforeColor = await productPreview.getAttribute("src");
  await swatches.nth(1).evaluate((button) => button.click());
  await page.waitForTimeout(200);
  const afterColor = await productPreview.getAttribute("src");
  check("garment colour changes the rendered image", Boolean(beforeColor && afterColor && beforeColor !== afterColor));
  check("catalogue colour swatches are exposed", swatchCount >= 6, `${swatchCount} swatches`);

  const addText = page.locator("button.rot-tool").filter({ hasText: "Add Text" }).first();
  await addText.evaluate((button) => button.click());
  await page.locator(".rot-textarea").fill("QA headline");
  check("text editor accepts editable copy", (await page.locator(".rot-textarea").inputValue()) === "QA headline");

  const fontRow = page.locator(".rot-row").filter({ hasText: "Anton" }).first();
  await fontRow.evaluate((row) => row.click());
  const fonts = page.locator(".rot-fontitem");
  const fontCount = await fonts.count();
  const fontScroller = page.locator(".rot-editor-scroll");
  const beforeScroll = await fontScroller.evaluate((node) => node.scrollTop);
  await fontScroller.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    node.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const afterScroll = await fontScroller.evaluate((node) => node.scrollTop);
  check("font library contains the expanded set", fontCount >= 10, `${fontCount} fonts`);
  check("font library scrolls inside the editor", afterScroll > beforeScroll);

  const ai = page.locator("button.rot-tool").filter({ hasText: "AI Design" }).first();
  await ai.evaluate((button) => button.click());
  await page.locator("#ai-design-prompt").fill("Kings United basketball team, bold retro style");
  await page
    .getByRole("button", { name: /generate editable design/i })
    .evaluate((button) => button.click());
  await page.waitForTimeout(250);
  await photo.waitFor({ state: "attached", timeout: 5000 });
  const canvas = page.locator(".rot-canvas-svg").first();
  const label = await canvas.getAttribute("aria-label");
  check("local AI assistant adds editable layers", /4 design element/.test(label ?? ""), label ?? "no canvas label");

  await page.goto(`${BASE}/customize/crown-classic-tee?qa=size-groups`, {
    waitUntil: "commit",
    timeout: 30000,
  });
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 15000 });
  await page.locator("button.rot-step").filter({ hasText: "Quantity" }).first().evaluate((button) => button.click());
  const sizeHeadings = await page.locator(".rot-size-group-title").allTextContents();
  const sizeLabels = await page.locator(".rot-size").allTextContents();
  check("quantity panel separates adult and youth sizes", sizeHeadings.join("|") === "Adult Sizes|Youth Sizes", sizeHeadings.join(" | "));
  check("classic tee exposes the requested size range", sizeLabels.some((label) => label.startsWith("YXS")) && sizeLabels.some((label) => label.startsWith("YXL")) && !sizeLabels.some((label) => label.startsWith("3XL")) && !sizeLabels.some((label) => label.startsWith("4XL")) && !sizeLabels.some((label) => label.startsWith("5XL")), sizeLabels.join(" | "));
  check("size groups fit the mobile viewport", (await page.locator("body").evaluate((node) => node.scrollWidth - window.innerWidth)) <= 1);

  await page.goto(`${BASE}/customize/v-neck-tee?qa=lock`, {
    waitUntil: "commit",
    timeout: 30000,
  });
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 15000 });
  await page.locator("button.rot-tool").filter({ hasText: "Add Art" }).first().evaluate((button) => button.click());
  await page.locator(".rot-artgrid button").first().evaluate((button) => button.click());
  await page.locator('button[aria-label="Lock"]').click();
  await page.locator('button[aria-label="Close"]').click();
  const canvasBox = await page.locator(".rot-canvas-svg").boundingBox();
  if (canvasBox) await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.waitForTimeout(100);
  check("selecting a locked artwork reopens it editable", (await page.locator('button[aria-label="Lock"]').count()) === 1 && (await page.locator('button[aria-label="Unlock"]').count()) === 0);
  check("customizer controls produce no browser errors", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (error) {
  failures += 1;
  console.log(`FAIL customizer control flow — ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
} finally {
  await browser.close();
}

console.log(failures ? `${failures} customizer control check(s) failed` : "ALL CUSTOMIZER CONTROL CHECKS PASSED");
process.exit(failures ? 1 : 0);
