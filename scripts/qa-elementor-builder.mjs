/**
 * Browser verification for the WordPress-style admin dashboard, visual drag-and-drop
 * page editor, inline editing, column resize splitter, storefront blocks,
 * media library picker, built-in storefront page overrides, and menu navigation.
 *
 * Requires a running site (default http://localhost:3000) and ADMIN_PASSWORD.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = (process.env.QA_BASE || "http://localhost:3000").replace(/\/$/, "");
const PASSWORD =
  process.env.QA_EDITOR_PASSWORD ||
  process.env.QA_ADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD;

if (!PASSWORD) {
  console.error("Set QA_EDITOR_PASSWORD (or QA_ADMIN_PASSWORD / ADMIN_PASSWORD) before running qa-elementor-builder.");
  process.exit(1);
}

let failures = 0;
const check = (label, condition, detail = "") => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}${condition || !detail ? "" : ` — ${detail}`}`);
  if (!condition) failures += 1;
};

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

const browser = await launchBrowser();
const consoleErrors = [];
const pageErrors = [];
let createdSlug = "";

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on("dialog", (d) => d.accept());
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(err.message));

try {
  /* ------------------------------------------------- 1. Sign in & sidebar */
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  const signInBtn = page.getByRole("button", { name: "Sign in" });
  await page.waitForFunction(() => {
    const btn = document.querySelector('button[type="submit"]');
    return Boolean(btn && !btn.hasAttribute("disabled"));
  }, { timeout: 15000 });
  await page.locator('input[type="password"]').fill(PASSWORD);
  await signInBtn.click();
  await page.getByRole("heading", { name: "Store overview" }).waitFor({ timeout: 15000 });

  for (const label of ["Overview", "Orders", "Page builder", "Media library", "Navigation", "Settings"]) {
    const visible = await page.locator("#admin-menu").getByRole("button", { name: label, exact: true }).isVisible();
    check(`sidebar shows '${label}'`, visible);
  }

  /* --------------------------------------------------- 2. Media library */
  await page.locator("#admin-menu").getByRole("button", { name: "Media library", exact: true }).click();
  await page.getByRole("heading", { name: "Media library" }).waitFor({ timeout: 10000 });
  const desktopMediaOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check("media library fits cleanly at 1440px", desktopMediaOverflow);

  /* ------------------------------------ 3. Built-in /about visual override */
  await page.locator("#admin-menu").getByRole("button", { name: "Page builder", exact: true }).click();
  await page.getByRole("heading", { name: "Pages & Visual Editor" }).waitFor({ timeout: 10000 });

  const aboutCard = page.locator('[aria-label="Storefront pages"] .builder-store-card', { hasText: "/about" });
  await aboutCard.waitFor({ timeout: 10000 });
  await aboutCard.getByRole("button", { name: "Edit visually" }).click();

  await page.locator(".admin.is-studio").waitFor({ timeout: 10000 });
  check("studio opens in full-bleed workspace mode", (await page.locator(".admin.is-studio").count()) === 1);

  const firstHeading = page.locator(".builder-canvas .kcp-b-inline-text").first();
  await firstHeading.waitFor({ timeout: 10000 });
  await firstHeading.dblclick();
  const activeEditable = page.locator('.builder-canvas .kcp-b-inline-text[contenteditable="true"]');
  await activeEditable.waitFor({ timeout: 5000 });
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Custom Printing Made Simple QA");
  await page.keyboard.press("Enter");

  const updatedCanvasText = await firstHeading.innerText();
  check("double-clicking heading edits inline on the canvas", updatedCanvasText.includes("Custom Printing Made Simple QA"));
  check("editing inline marks unsaved changes", await page.getByText("Unsaved changes").isVisible());

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Published. Visitors can see this page now.").waitFor({ timeout: 10000 });

  const aboutRes = await context.request.get(`${BASE}/about`);
  const aboutHtml = await aboutRes.text();
  check("customized /about page renders live heading for visitors", aboutRes.status() === 200 && aboutHtml.includes("Custom Printing Made Simple QA"));

  await page.getByRole("tab", { name: "Page", exact: true }).click();
  await page.getByRole("button", { name: "Restore default page" }).click();
  await page.getByText(/Storefront page restored/i).waitFor({ timeout: 10000 });

  const restoredAboutHtml = await (await context.request.get(`${BASE}/about`)).text();
  check("restoring default page reverts /about to stock storefront layout", !restoredAboutHtml.includes("Custom Printing Made Simple QA"));

  await page.getByRole("button", { name: "Discard custom layout" }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("heading", { name: "Pages & Visual Editor" }).waitFor({ timeout: 10000 });

  /* ---------------------------- 4. Starter page + D&D + Resize + Media */
  createdSlug = `team-gear-qa-${Date.now().toString(36)}`;
  await page.getByRole("button", { name: "New page" }).click();
  const createDialog = page.getByRole("dialog", { name: "Create a new page" });
  await createDialog.waitFor({ timeout: 5000 });
  await createDialog.getByLabel("Page title").fill("Team Gear QA");
  await createDialog.getByLabel("Page address").fill(createdSlug);
  await createDialog.locator(".builder-starter-card", { hasText: "Blank page" }).click();
  await createDialog.getByRole("button", { name: "Create & open editor" }).click();
  await page.locator(".admin.is-studio").waitFor({ timeout: 10000 });

  // Switch Section 1 to 2 columns via toolbar preset
  const twoColPresetBtn = page.locator('.kcp-b-section-toolbar button[title*="2 equal columns"]').first();
  await twoColPresetBtn.click({ force: true });
  const resizer = page.locator(".kcp-b-col-resizer").first();
  await resizer.waitFor({ timeout: 5000 });

  const colZero = page.locator(".kcp-b-col-shell").first();
  const initialBox = await colZero.boundingBox();
  const resizerBox = await resizer.boundingBox();
  assert(initialBox && resizerBox, "column boxes must be measurable");

  await page.mouse.move(resizerBox.x + resizerBox.width / 2, resizerBox.y + resizerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizerBox.x + resizerBox.width / 2 + 110, resizerBox.y + resizerBox.height / 2, { steps: 8 });
  await page.mouse.up();

  const resizedBox = await colZero.boundingBox();
  check(
    "dragging column divider resizes adjacent columns on canvas",
    Boolean(resizedBox && resizedBox.width > initialBox.width + 25),
    `before=${Math.round(initialBox.width)} after=${Math.round(resizedBox?.width ?? 0)}`
  );

  // Drag Product grid block from left palette onto column 1
  const paletteProductGrid = page.locator(".builder-palette-item", { hasText: "Product grid" });
  const firstColumn = page.locator(".kcp-b-column").first();
  await paletteProductGrid.dragTo(firstColumn);
  await page.locator(".builder-canvas .kcp-b-product-grid .mm-card").first().waitFor({ timeout: 10000 });
  check(
    "dragging Product grid onto canvas renders live catalog products",
    (await page.locator(".builder-canvas .kcp-b-product-grid .mm-card").count()) >= 1
  );

  // Add Image block & pick photo from MediaPickerModal
  await page.locator(".builder-palette-item", { hasText: "Image" }).click();
  await page.getByRole("button", { name: "Choose photo" }).click();
  const picker = page.getByRole("dialog", { name: "Choose a photo" });
  await picker.waitFor({ timeout: 5000 });
  const storePhotosTab = picker.getByRole("button", { name: /Store photos/i });
  if (await storePhotosTab.isVisible()) await storePhotosTab.click();
  await picker.getByRole("button", { name: "Use photo" }).first().click();
  await picker.waitFor({ state: "hidden", timeout: 5000 });
  check(
    "picking a photo from MediaPickerModal renders image inside widget",
    (await page.locator(".builder-canvas .kcp-b-image").count()) >= 1
  );

  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Published. Visitors can see this page now.").waitFor({ timeout: 10000 });

  /* ------------------------------------- 5. Add published page to Header */
  await page.getByRole("button", { name: "← Pages" }).click();
  await page.getByRole("heading", { name: "Pages & Visual Editor" }).waitFor({ timeout: 10000 });
  await page.locator("#admin-menu").getByRole("button", { name: "Navigation", exact: true }).click();
  await page.getByRole("heading", { name: "Navigation menus" }).waitFor({ timeout: 10000 });

  const customPageRow = page.locator(".admin-nav-suggestions li", { hasText: "Team Gear QA" }).first();
  await customPageRow.waitFor({ timeout: 5000 });
  await customPageRow.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Save menus" }).click();
  await page.getByText(/Navigation menus saved/i).waitFor({ timeout: 10000 });

  /* ------------------------------------- 6. Mobile admin responsiveness */
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileAdminOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check("admin dashboard fits cleanly at 390px mobile width", mobileAdminOverflow);
  const toggleBtn = page.locator(".admin-menu-toggle");
  await toggleBtn.click();
  await page.locator("#admin-menu").getByRole("button", { name: "Media library", exact: true }).click();
  await page.getByRole("heading", { name: "Media library" }).waitFor({ timeout: 5000 });
  check(
    "mobile media library view has zero horizontal overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  );

  /* ----------------------------- 7. Visitor storefront renders custom page */
  const visitor = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  visitor.on("pageerror", (err) => pageErrors.push(err.message));
  const response = await visitor.goto(`${BASE}/${createdSlug}`, { waitUntil: "domcontentloaded" });
  check("published custom page serves 200", response?.status() === 200);
  await visitor.locator(".kcp-b-product-grid .mm-card").first().waitFor({ timeout: 10000 });
  const navHasPage = await visitor.locator("header nav").getByRole("link", { name: "Team Gear QA" }).isVisible();
  check("header navigation displays link added from menu editor", navHasPage);
  await visitor.setViewportSize({ width: 390, height: 844 });
  check(
    "live custom page fits 390px mobile viewport cleanly",
    await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  );
  await visitor.close();

  check("zero browser console errors during flow", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("zero uncaught page errors during flow", pageErrors.length === 0, pageErrors.join(" | "));
} finally {
  if (createdSlug) {
    await context.request.delete(`${BASE}/api/admin/navigation`).catch(() => {});
    await context.request.post(`${BASE}/api/admin/builder`, {
      data: { action: "delete", slug: createdSlug },
    }).catch(() => {});
    await context.request.post(`${BASE}/api/admin/builder`, {
      data: { action: "delete", slug: "about" },
    }).catch(() => {});
  }
  await browser.close();
}

console.log(failures ? `\n${failures} builder UI check(s) failed` : "\nall builder UI checks passed");
process.exit(failures ? 1 : 0);
