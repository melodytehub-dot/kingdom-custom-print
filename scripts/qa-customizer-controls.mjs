/**
 * Customer-facing customizer interaction smoke test.
 * Covers product/color synchronization, cross-product design retention,
 * text editing, font scrolling, and the non-AI Text Ideas tool.
 */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const BROWSER = process.env.QA_BROWSER ?? "chrome";
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch({ channel: BROWSER, headless: true });
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
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 60000 });

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
  const selectedSlug = await swatches.nth(1).getAttribute("data-color-slug");
  check("selected color is reflected in the URL", new URL(page.url()).searchParams.get("color") === selectedSlug, `${selectedSlug} -> ${new URL(page.url()).searchParams.get("color")}`);
  const mainImage = await photo.getAttribute("href");
  const selectedTile = await page.locator(".rot-blank.is-active img").getAttribute("src");
  check("canvas, product preview, and active product tile use the same variant", mainImage === afterColor && afterColor === selectedTile);
  await page.reload({ waitUntil: "commit" });
  await photo.waitFor({ state: "attached", timeout: 60000 });
  await products.evaluate((button) => button.click());
  const refreshedSlug = await page.locator(".rot-garment[aria-pressed=true]").getAttribute("data-color-slug");
  check("direct refresh restores the selected product color", refreshedSlug === new URL(page.url()).searchParams.get("color") && refreshedSlug === selectedSlug, `${refreshedSlug} after reload`);

  const addText = page.locator("button.rot-tool").filter({ hasText: "Add Text" }).first();
  await addText.evaluate((button) => button.click());
  await page.getByRole("textbox", { name: "New text", exact: true }).fill("QA headline");
  await page.getByRole("button", { name: "+ Add text", exact: true }).click();
  const textEditor = page.getByRole("textbox", { name: "Your text", exact: true });
  await textEditor.fill("QA headline");
  check("text editor accepts editable copy", (await textEditor.inputValue()) === "QA headline");

  const fontRow = page.locator(".rot-row.is-link").filter({ hasText: "Font" }).first();
  await fontRow.evaluate((row) => row.click());
  const fonts = page.locator(".rot-fontitem");
  const fontCount = await fonts.count();
  const fontScroller = page.locator(".rot-editor").first();
  const beforeScroll = await fontScroller.evaluate((node) => node.scrollTop);
  await fontScroller.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    node.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const afterScroll = await fontScroller.evaluate((node) => node.scrollTop);
  check("font library contains the expanded set", fontCount >= 10, `${fontCount} fonts`);
  check("font library scrolls inside the editor", afterScroll > beforeScroll);

  const ideas = page.locator("button.rot-tool").filter({ hasText: "Text Ideas" }).first();
  await ideas.evaluate((button) => button.click());
  await page.locator("#text-ideas-prompt").fill("Kings United basketball team, bold retro style");
  await page.getByRole("button", { name: /add lettering/i }).evaluate((button) => button.click());
  await page.waitForTimeout(250);
  await photo.waitFor({ state: "attached", timeout: 5000 });
  const canvas = page.locator(".rot-canvas-svg").first();
  const label = await canvas.getAttribute("aria-label");
  check("non-AI text ideas add editable layers", /3 design element/.test(label ?? ""), label ?? "no canvas label");

  await page.locator("button.rot-tool").filter({ hasText: "Saved" }).first().evaluate((button) => button.click());
  await page.getByRole("button", { name: "Save current design", exact: true }).click();
  await page.locator("button.rot-tool").filter({ hasText: "Products" }).first().evaluate((button) => button.click());
  await page.getByRole("searchbox", { name: "Search products or style" }).fill("Premium Pullover Hoodie");
  await page.locator(".rot-blank").filter({ hasText: "Premium Pullover Hoodie" }).click();
  await page.waitForURL(/\/customize\/premium-pullover-hoodie/);
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 60000 });
  const carriedLayers = await page.locator(".rot-canvas-svg").getAttribute("aria-label");
  check("switching products retains all artwork", /3 design element/.test(carriedLayers ?? ""), carriedLayers ?? "no canvas label");
  check("product switch keeps a compatible selected color", new URL(page.url()).searchParams.get("color") === "black", new URL(page.url()).searchParams.get("color") ?? "no color in URL");
  await page.locator("button.rot-tool").filter({ hasText: "Saved" }).first().evaluate((button) => button.click());
  await page.locator(".rot-draft").first().evaluate((button) => button.click());
  await page.waitForURL(/\/customize\/v-neck-tee/);
  const restoredLayers = await page.locator(".rot-canvas-svg").getAttribute("aria-label");
  check("saved design reopens on its original product, color, and artwork", new URL(page.url()).searchParams.get("color") === "black" && /3 design element/.test(restoredLayers ?? ""), `${new URL(page.url()).searchParams.get("color")} · ${restoredLayers ?? "no canvas label"}`);

  await page.goto(`${BASE}/customize/crown-classic-tee?qa=size-groups`, {
    waitUntil: "commit",
    timeout: 30000,
  });
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 60000 });
  await page.locator("button.rot-step").filter({ hasText: "Quantity" }).first().evaluate((button) => button.click());
  const sizeHeadings = await page.locator(".rot-size-group-title").allTextContents();
  const sizeLabels = await page.locator(".rot-size").allTextContents();
  check("quantity panel separates adult and youth sizes", sizeHeadings.join("|") === "Adult Sizes|Youth Sizes", sizeHeadings.join(" | "));
  check("classic tee exposes adult through 5XL and the youth size run", ["3XL", "4XL", "5XL", "YXS", "YXL"].every((size) => sizeLabels.some((label) => label.startsWith(size))), sizeLabels.join(" | "));
  check("size groups fit the mobile viewport", (await page.locator("body").evaluate((node) => node.scrollWidth - window.innerWidth)) <= 1);

  await page.goto(`${BASE}/customize/youth-classic-tee?color=white&sizes=YXS%3A1`, {
    waitUntil: "commit",
    timeout: 30000,
  });
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 60000 });
  await page.locator("button.rot-tool").filter({ hasText: "Add Art" }).first().evaluate((button) => button.click());
  await page.locator(".rot-artgrid button").first().evaluate((button) => button.click());
  const configuredPriceLabel = await page.locator(".rot-bar-price strong").innerText();
  check("configured order price is distinguished from the blank catalog price", configuredPriceLabel.startsWith("Order $") && configuredPriceLabel.includes(" total"), configuredPriceLabel);
  await page.locator("button.rot-tool").filter({ hasText: "Products" }).first().evaluate((button) => button.click());
  await page.getByRole("searchbox", { name: "Search products or style" }).fill("Premium Pullover Hoodie");
  await page.locator(".rot-blank").filter({ hasText: "Premium Pullover Hoodie" }).click();
  await page.getByRole("heading", { name: "Unavailable sizes" }).waitFor({ state: "visible" });
  check("incompatible product switch explains unsupported quantities", await page.locator(".rot-switch-impact").innerText().then((text) => /YXS.*1/.test(text)));
  await page.getByRole("button", { name: "Keep current product", exact: true }).click();
  check("cancel keeps the selected product and quantity", /\/customize\/youth-classic-tee/.test(page.url()) && new URL(page.url()).searchParams.get("sizes") === "YXS:1");
  await page.locator(".rot-blank").filter({ hasText: "Premium Pullover Hoodie" }).click();
  await page.getByRole("button", { name: "Continue without unavailable sizes", exact: true }).click();
  await page.waitForURL(/\/customize\/premium-pullover-hoodie/);
  const retainedArtwork = await page.locator(".rot-canvas-svg").getAttribute("aria-label");
  check("confirmed product switch keeps compatible artwork", /1 design element/.test(retainedArtwork ?? ""), retainedArtwork ?? "no canvas label");
  check("confirmed switch removes only unavailable size quantities", !new URL(page.url()).searchParams.has("sizes"));

  await page.goto(`${BASE}/customize/v-neck-tee?qa=lock`, {
    waitUntil: "commit",
    timeout: 30000,
  });
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 60000 });
  await page.locator("button.rot-tool").filter({ hasText: "Add Art" }).first().evaluate((button) => button.click());
  await page.locator(".rot-artgrid button").first().evaluate((button) => button.click());
  await page.locator('button[aria-label="Lock"]').click();
  await page.locator('button[aria-label="Close"]').click();
  const canvasBox = await page.locator(".rot-canvas-svg").boundingBox();
  if (canvasBox) await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.waitForTimeout(100);
  check("selecting a locked artwork keeps it locked and exposes Unlock", (await page.locator('button[aria-label="Unlock"]').count()) === 1 && (await page.locator('button[aria-label="Lock"]').count()) === 0);
  check("customizer controls produce no browser errors", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (error) {
  failures += 1;
  console.log(`FAIL customizer control flow — ${error instanceof Error ? error.stack?.split("\n").slice(0, 2).join(" ") : String(error)}`);
} finally {
  await browser.close();
}

console.log(failures ? `${failures} customizer control check(s) failed` : "ALL CUSTOMIZER CONTROL CHECKS PASSED");
process.exit(failures ? 1 : 0);
