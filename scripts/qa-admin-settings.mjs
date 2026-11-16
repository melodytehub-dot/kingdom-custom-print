/**
 * Browser checks for the dashboard Settings tab (header and footer copy).
 * Restores the original settings when it finishes.
 *
 *   QA_BASE=http://localhost:3026 QA_EDITOR_PASSWORD=... QA_ENGINE=Chrome node scripts/qa-admin-settings.mjs
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${index + 81}` } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const original = await (async () => {
    const login = await context.request.post(`${base}/api/admin/login`, { data: { password } });
    assert.equal(login.ok(), true, "sign in");
    const response = await context.request.get(`${base}/api/admin/settings`);
    assert.equal(response.ok(), true, "settings load");
    return response.json();
  })();
  try {
    await page.goto(`${base}/admin?tab=settings`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("heading", { name: "Site settings", exact: true }).waitFor({ timeout: 60000 });
    // WebKit can accept typing before the page hydrates, which React then
    // reverts to the server values. Re-apply until every value sticks at once.
    const fields = [
      ["Announcement bar", "QA free shipping over $75"],
      ["Announcement link", "/shop"],
      ["Footer introduction", "QA footer introduction for the storefront."],
    ];
    let settled = false;
    for (let attempt = 0; attempt < 8 && !settled; attempt += 1) {
      for (const [label, value] of fields) await page.getByLabel(label, { exact: true }).fill(value);
      await page.waitForTimeout(400);
      settled = true;
      for (const [label, value] of fields) {
        if (await page.getByLabel(label, { exact: true }).inputValue() !== value) settled = false;
      }
    }
    if (!settled) throw new Error("Could not set the settings fields");
    await page.getByRole("button", { name: "Save settings", exact: true }).click();
    await page.getByText(/Settings saved|Saved/i).first().waitFor({ timeout: 60000 });

    const storefront = await context.newPage();
    const banner = storefront.locator('.mm-announcement a.mm-announcement-item[href="/shop"]').first();
    // The homepage is served from cache for up to a minute, so retry until the
    // saved copy appears rather than asserting the very first response.
    for (let attempt = 0; ; attempt += 1) {
      await storefront.goto(`${base}/?qa=${Date.now()}-${attempt}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const text = await storefront.locator(".mm-announcement").innerText().catch(() => "");
      const footer = await storefront.locator(".mm-footer-brand-info p").innerText().catch(() => "");
      if (text.includes("QA free shipping over $75") && footer.includes("QA footer introduction")) break;
      if (attempt >= 24) throw new Error(`Homepage did not show the saved copy. Banner: ${text.trim()} Footer: ${footer.trim()}`);
      await storefront.waitForTimeout(2000);
    }
    await banner.waitFor({ timeout: 10000 });
    assert.match(await banner.innerText(), /QA free shipping over \$75/);
    await storefront.getByText("QA footer introduction for the storefront.").waitFor({ timeout: 10000 });
    await storefront.setViewportSize({ width: 375, height: 800 });
    assert.equal(await storefront.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "announcement link fits a phone screen");
    await storefront.close();

    await page.setViewportSize({ width: 375, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "settings tab fits a phone screen");
    assert.deepEqual(pageErrors, []);
    console.log(`PASS ${name}: header and footer copy saves and renders`);
  } finally {
    await context.request.put(`${base}/api/admin/settings`, { data: { announcement: original.announcement, announcementLink: original.announcementLink, footerBlurb: original.footerBlurb } }).catch(() => {});
    await context.request.post(`${base}/api/admin/logout`).catch(() => {});
    await browser.close();
  }
}

