import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";

const base = process.env.QA_BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
const errors = [];
let activePage;
const key = "kcp.draft.v3.crown-classic-tee";
const screenshot = (page, name) => page.screenshot({ path: path.join(os.tmpdir(), `kingdom-${name}.png`) });
const state = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).design, key);
const amount = (value) => Number((value ?? "").replace(/[^\d.]/g, ""));
const overlay = (page) => page.locator(".rot-canvas-svg > g:last-of-type > g").last().locator(":scope > rect").first();
const center = async (locator) => { const b = await locator.boundingBox(); assert.ok(b); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const scrollToCollections = async (page) => {
  const section = page.locator(".mm-client-collections");
  await section.waitFor({ state: "attached", timeout: 45000 });
  await page.waitForTimeout(700);
  const viewport = page.viewportSize();
  await page.mouse.move(Math.max(30, Math.floor((viewport?.width ?? 800) / 2)), Math.max(30, Math.floor((viewport?.height ?? 600) / 2)));
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const top = await section.evaluate((node) => node.getBoundingClientRect().top);
    if (top < (viewport?.height ?? 600) * 0.75) break;
    await page.mouse.wheel(0, Math.min(top * 0.7, (viewport?.height ?? 600) * 1.25));
    await page.waitForTimeout(200);
  }
  await page.waitForFunction(() => {
    const rect = document.querySelector(".mm-client-collections")?.getBoundingClientRect();
    return Boolean(rect && rect.top < innerHeight && rect.bottom > 0);
  }, null, { timeout: 10000 }).catch(async (error) => {
    const position = await page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight, locked: document.body.hasAttribute("data-lock"), behavior: document.documentElement.style.scrollBehavior, rect: document.querySelector(".mm-client-collections")?.getBoundingClientRect().toJSON() }));
    throw new Error(`Could not scroll to homepage categories: ${JSON.stringify(position)}; ${error.message}`);
  });
};

try {
  const sizes = process.env.QA_WORKFLOW_ONLY ? [] : process.env.QA_LANDSCAPE_ONLY ? [[844, 390]] : [[1440, 900], [390, 844], [320, 568], [844, 390]];
  for (const [width, height] of sizes) {
    const mobile = width <= 900;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile });
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/customize/crown-classic-tee?color=white&sizes=M%3A1`, { waitUntil: "domcontentloaded" });
    await page.locator(".rot-canvas-svg").waitFor();
    const tap = async (point) => mobile ? page.touchscreen.tap(point.x, point.y) : page.mouse.click(point.x, point.y);
    const drag = async (from, to) => {
      if (mobile) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
        for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (to.x - from.x) * i / 10, y: from.y + (to.y - from.y) * i / 10 }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(from.x, from.y); await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 10 }); await page.mouse.up();
      }
    };
    await page.locator(".rot-tool").filter({ hasText: "Add Text" }).click();
    await page.getByRole("textbox", { name: "New text", exact: true }).fill("KINGDOM");
    await page.getByRole("button", { name: "+ Add text", exact: true }).click();
    await page.getByRole("textbox", { name: "Your text" }).fill("KINGDOM");
    await page.getByRole("button", { name: "Done editing", exact: true }).click();
    let before = await state(page);
    let point = await center(overlay(page));
    await drag(point, { x: point.x + 24, y: point.y + 20 });
    assert.equal(await page.locator(".rot").getAttribute("data-layout"), "none", "drag must not open editor");
    let after = await state(page);
    assert.notEqual(after.front[0].x, before.front[0].x, "drag moves text");
    // Undo before the text-entry debounce expires must undo the latest gesture.
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    assert.equal((await state(page)).front[0].x, before.front[0].x);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    assert.equal((await state(page)).front[0].x, after.front[0].x);
    await tap(await center(overlay(page)));
    await page.getByRole("textbox", { name: "Your text" }).waitFor({ state: "visible" });
    await page.getByLabel("Rotate value", { exact: true }).fill("25");
    await page.getByLabel("Rotate value", { exact: true }).press("Tab");
    assert.equal((await state(page)).front[0].rotation, 25);
    await screenshot(page, `editor-${width}x${height}`);
    await page.getByRole("button", { name: "Done editing", exact: true }).click();
    // Select by dragging, then resize without opening the panel.
    point = await center(overlay(page));
    await drag(point, { x: point.x + 8, y: point.y + 8 });
    const handle = await center(page.getByRole("button", { name: "Resize", exact: true }));
    await screenshot(page, `resize-${width}x${height}`);
    before = await state(page);
    await drag(handle, { x: handle.x + 14, y: handle.y + 14 });
    assert.notEqual((await state(page)).front[0].scaleX, before.front[0].scaleX);
    for (const label of ["Add Art", "Products", "Text Ideas", "Saved", "Distress", "Personalize", "Upload Art"]) {
      if (process.env.QA_LANDSCAPE_ONLY) console.log(`Checking ${label}`);
      await page.locator(".rot-tool").filter({ hasText: label }).click();
      await page.waitForFunction(() => document.querySelector(".rot").dataset.layout !== "none");
      assert.notEqual(await page.locator(".rot").getAttribute("data-layout"), "none");
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      // Blank canvas tap dismisses every inspector without hitting layer controls.
      const b = await page.locator(".rot-canvas-svg").boundingBox();
      await tap({ x: b.x + 6, y: b.y + 6 });
      await page.waitForFunction(() => document.querySelector(".rot").dataset.layout === "none");
      assert.equal(await page.locator(".rot").getAttribute("data-layout"), "none", `${label} dismisses`);
    }
    await page.locator(".rot-tool").filter({ hasText: "Add Art" }).click();
    await page.getByRole("searchbox", { name: "Search artwork" }).fill("star");
    await page.locator(".rot-artgrid button").first().click();
    assert.equal((await state(page)).front.length, 2);
    const b = await page.locator(".rot-canvas-svg").boundingBox();
    await tap({ x: b.x + 6, y: b.y + 6 });
    await page.getByRole("button", { name: "Back view", exact: true }).click();
    assert.match(await page.locator(".rot-canvas-svg").getAttribute("aria-label"), /^back/);
    await page.getByRole("button", { name: "Front view", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("spinbutton", { name: "Adult M quantity", exact: true }).fill("2");
    await page.getByRole("button", { name: "Review", exact: true }).click();
    assert.equal(await page.locator(".rot").getAttribute("data-step"), "review");
    await page.locator("button.rot-step").filter({ hasText: "Design" }).click();
    await screenshot(page, `studio-${width}x${height}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow");
    console.log(`PASS ${width}x${height}: touch/mouse drag, tap, immediate undo/redo, rotate, resize, panels, art, sides, quantity/review`);
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage = page;
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    if (navigator.canShare) navigator.share = async () => { throw new DOMException("Share UI unavailable", "NotAllowedError"); };
  });
  await page.goto(`${base}/customize/crown-classic-tee?color=white&sizes=M%3A1`, { waitUntil: "domcontentloaded" });
  await page.locator(".rot-canvas-svg").waitFor();
  const artwork = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><circle cx="60" cy="60" r="45" fill="red"/></svg>';
  await page.locator('input[type="file"]').setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from(artwork) });
  await page.locator(".rot-editor").waitFor({ state: "visible" });
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).design.front.length, key), 1);
  for (const event of ["drop", "paste"]) {
    await page.locator(".rot").evaluate((root, { artwork, event }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([artwork], "logo.svg", { type: "image/svg+xml" }));
      root.dispatchEvent(event === "drop" ? new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }) : new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
    }, { artwork, event });
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).design.front.length, key), event === "drop" ? 2 : 3);
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("kcp.drafts.v1")).length), 1);
  await page.locator("button.rot-step").filter({ hasText: "Quantity" }).click();
  await page.getByRole("spinbutton", { name: "Adult M quantity", exact: true }).fill("2");
  await page.locator("button.rot-step").filter({ hasText: "Design" }).click();
  await page.locator(".rot-tool").filter({ hasText: "Products" }).click();
  await page.locator('button.rot-garment[aria-label="Black"]').click();
  await page.locator("button.rot-step").filter({ hasText: "Quantity" }).click();
  await page.getByRole("spinbutton", { name: "Adult M quantity", exact: true }).fill("2");
  await page.locator("button.rot-step").filter({ hasText: "Design" }).click();
  await page.locator(".rot-tool").filter({ hasText: "Saved" }).click();
  await page.locator(".rot-draft").first().click();
  await page.waitForFunction((key) => {
    const draft = JSON.parse(localStorage.getItem(key) ?? "null");
    return draft?.colorCode === "white" && draft?.lines?.M === 1 && draft?.design?.front?.length === 3;
  }, key);
  assert.equal(new URL(page.url()).searchParams.get("color"), "white");
  await page.locator("button.rot-step").filter({ hasText: "Quantity" }).click();
  assert.equal(await page.getByRole("spinbutton", { name: "Adult M quantity", exact: true }).inputValue(), "1");
  await page.locator("button.rot-step").filter({ hasText: "Design" }).click();
  console.log("PASS saved draft restores color, artwork, and size quantities after edits");
  const downloadEvent = new Promise((resolve) => page.once("download", resolve));
  await page.getByRole("button", { name: "Share this design", exact: true }).click();
  const download = await Promise.race([downloadEvent, page.waitForTimeout(3000).then(() => null)]);
  if (!download) console.log("Share diagnostic", await page.evaluate(() => ({ canShare: navigator.canShare?.({ files: [new File(["x"], "x.png", { type: "image/png" })] }), notice: document.querySelector(".rot-toast")?.textContent, busy: document.querySelector(".rot-next")?.disabled })));
  assert.ok(download, "sharing opens the native file share sheet or downloads the preview");
  assert.equal(download.suggestedFilename(), "crown-classic-tee-front.png");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const reviewText = await page.locator(".rot-review").innerText();
  assert.match(reviewText, /Crown Classic Tee\s+·\s+RT2000/);
  assert.match(reviewText, /White/);
  assert.match(reviewText, /M × 1 at \$[\d.]+ each/);
  assert.match(reviewText, /Front/);
  assert.match(reviewText, /Elements\s+3/);
  const reviewSubtotal = amount(await page.locator(".rot-review li.is-total strong").innerText());
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("kcp.cart.v1") ?? "[]").length === 1);
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("kcp.cart.v1"))[0]);
  assert.equal(cart.design.front.length, 3);
  assert.ok(cart.previewFront.startsWith("data:image/"));
  assert.equal(cart.lines[0].qty, 1);
  assert.equal(cart.total, reviewSubtotal);
  await page.locator("button.rot-step").filter({ hasText: "Design" }).click();
  await page.locator(".rot-tool").filter({ hasText: "Products" }).click();
  await page.locator('button.rot-garment[aria-label="Black"]').click();
  await page.locator("button.rot-step").filter({ hasText: "Quantity" }).click();
  await page.getByRole("spinbutton", { name: "Adult M quantity", exact: true }).fill("1");
  await page.locator("button.rot-step").filter({ hasText: "Review" }).click();
  assert.match(await page.locator(".rot-review").innerText(), /Black/);
  await page.getByRole("button", { name: "Add another", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("kcp.cart.v1") ?? "[]").length === 2);
  const cartItems = await page.evaluate(() => JSON.parse(localStorage.getItem("kcp.cart.v1")));
  assert.deepEqual(cartItems.map((item) => item.colorSlug), ["white", "black"]);
  assert.ok(cartItems.every((item) => item.design.front.length === 3));
  console.log("PASS file upload, drop, paste, draft restore, preview download, and same design added in two colors");
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const teamBanner = page.locator(".mm-banner-box-team");
  await teamBanner.locator("img").waitFor({ state: "attached" });
  await teamBanner.locator("h3.mm-banner-title").waitFor({ state: "attached" });
  assert.equal(await teamBanner.count(), 1);
  assert.equal((await teamBanner.locator("h3.mm-banner-title").innerText()).trim(), "CROSSFIT & TEAMS");
  assert.match(await teamBanner.locator("img").getAttribute("src"), /kingdom-team\.webp/);
  assert.equal(await teamBanner.getAttribute("href"), "/customize");
  assert.match(await teamBanner.innerText(), /DESIGN YOURS/);
  assert.equal(await teamBanner.locator("img").evaluate((image) => getComputedStyle(image).objectPosition), "50% 0%");
  await scrollToCollections(page);
  try {
    await page.waitForFunction(() => [...document.querySelectorAll(".mm-collection img")].every((img) => img.complete && img.naturalWidth > 0), null, { timeout: 45000 });
  } catch (error) {
    console.log("Collection image diagnostics", JSON.stringify(await page.locator(".mm-collection img").evaluateAll((images) => images.map((img) => ({ src: img.currentSrc, complete: img.complete, naturalWidth: img.naturalWidth, loading: img.loading })))));
    throw error;
  }
  assert.equal(await page.locator(".mm-collection").count(), 4);
  await screenshot(page, "collections-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await scrollToCollections(page);
  const teamLayout = await page.locator(".mm-banner-box-team").evaluate((node) => {
    const photo = node.querySelector(".mm-banner-team-photo").getBoundingClientRect();
    const copy = node.querySelector(".mm-banner-content").getBoundingClientRect();
    return { ratio: photo.width / photo.height, copyBelowPhoto: copy.top >= photo.bottom };
  });
  assert.ok(Math.abs(teamLayout.ratio - 0.75) < 0.02);
  assert.equal(teamLayout.copyBelowPhoto, true);
  await screenshot(page, "collections-mobile");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
  console.log("PASS four client photos loaded; desktop/mobile homepage has no overflow; no studio runtime errors");
} catch (error) {
  if (activePage && !activePage.isClosed()) await screenshot(activePage, "failure");
  throw error;
} finally {
  await browser.close();
}
