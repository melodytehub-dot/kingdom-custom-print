/**
 * Browser checks for the dashboard Pages builder against an isolated server.
 * Creates and deletes its own test page.
 *
 *   QA_BASE=http://localhost:3026 QA_EDITOR_PASSWORD=... QA_ENGINE=Chrome node scripts/qa-admin-pages.mjs
 */
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const base = process.env.QA_BASE ?? "http://localhost:3026";
const password = process.env.QA_EDITOR_PASSWORD;
if (!password) throw new Error("Set QA_EDITOR_PASSWORD for an isolated development server.");
const engines = [["Chrome", chromium, { channel: "chrome" }], ["Edge", chromium, { channel: "msedge" }], ["WebKit", webkit, {}]]
  .filter(([name]) => !process.env.QA_ENGINE || process.env.QA_ENGINE === name);

for (const [index, [name, engine, options]] of engines.entries()) {
  const browser = await engine.launch({ ...options, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${index + 61}` } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const slug = `qa-builder-${Date.now().toString(36)}`;
  try {
    await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator('button[type="submit"]:enabled').waitFor({ timeout: 60000 });
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("heading", { name: "Store overview" }).waitFor({ timeout: 60000 });

    // Remove pages left behind by an interrupted run.
    const existing = await context.request.get(`${base}/api/admin/pages`);
    for (const leftover of ((await existing.json()).pages ?? []).filter(item => item.slug.startsWith("qa-builder-"))) {
      await context.request.post(`${base}/api/admin/pages`, { data: { action: "delete", id: leftover.id } });
    }

    if (await page.locator(".admin-menu-toggle").isVisible()) await page.locator(".admin-menu-toggle").click();
    await page.locator("#admin-menu").getByRole("button", { name: "Pages", exact: true }).click();
    await page.waitForURL("**/admin?tab=pages");
    await page.getByRole("heading", { name: "Pages", exact: true }).waitFor({ timeout: 60000 });

    await page.getByRole("button", { name: "New page", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill("QA Size Guide");
    await page.getByLabel("Page address", { exact: true }).fill(slug);
    await page.getByLabel("Introduction", { exact: true }).fill("How to choose the right size.");

    await page.getByRole("button", { name: "Add heading", exact: true }).click();
    await page.getByLabel("Heading text").fill("Measure a shirt you own");
    await page.getByLabel("Text", { exact: true }).fill("Lay it flat, then measure across the chest.");
    await page.getByRole("button", { name: "Add button", exact: true }).click();
    await page.getByLabel("Button text").fill("Shop blanks");
    await page.getByLabel("Button link").fill("/shop");

    await page.getByRole("button", { name: "Save page", exact: true }).click();
    await page.getByText("Page saved.").waitFor({ timeout: 60000 });
    const row = page.locator(".admin-page-list li", { hasText: `/${slug}` });
    await row.waitFor();
    const rowText = await row.innerText();
    assert.match(rowText, /draft/i, `saved page starts as a draft (row: ${rowText.replace(/\n/g, " | ")})`);
    assert.match(rowText, new RegExp(`/${slug}`));

    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Publish this page on the website").check();
    await page.getByRole("button", { name: "Save page", exact: true }).click();
    await page.getByText("Page saved.").waitFor({ timeout: 60000 });
    await row.waitFor();
    assert.match(await row.innerText(), /published/i, "page publishes");

    const published = await context.newPage();
    await published.goto(`${base}/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await published.getByRole("heading", { name: "QA Size Guide", exact: true }).waitFor();
    assert.equal(await published.getByRole("heading", { name: "Measure a shirt you own" }).count(), 1, "heading block renders");
    assert.equal(await published.getByRole("link", { name: "Shop blanks" }).getAttribute("href"), "/shop", "button block links onward");
    await published.setViewportSize({ width: 375, height: 800 });
    assert.equal(await published.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "page fits a phone screen");
    await published.close();

    await page.setViewportSize({ width: 375, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "pages tab fits a phone screen");
    await page.setViewportSize({ width: 1280, height: 900 });

    page.once("dialog", dialog => dialog.accept());
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByText("Page deleted.").waitFor({ timeout: 60000 });
    assert.equal(await page.locator(".admin-page-list li", { hasText: `/${slug}` }).count(), 0, "deleted page leaves the list");

    const gone = await context.newPage();
    await gone.goto(`${base}/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(await gone.title(), "Page not found | Kingdom Custom Print", "deleted page is no longer served");
    await gone.close();

    assert.deepEqual(pageErrors, []);
    console.log(`PASS ${name}: create, publish, view, and delete a page from the dashboard`);
  } finally {
    await context.request.post(`${base}/api/admin/logout`).catch(() => {});
    await browser.close();
  }
}


