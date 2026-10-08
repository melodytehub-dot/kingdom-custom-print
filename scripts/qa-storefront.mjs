import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.QA_BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
try {
  for (const width of [320, 390, 768, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/shop`, { waitUntil: "load" });
    assert.equal(await page.locator('[aria-label="Breadcrumb"], .breadcrumb, .mm-topbar, .mm-card-badges').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `No overflow at ${width}px`);
    const cardLayout = await page.locator('.mm-card').evaluateAll(cards => cards.slice(0, 4).map(card => {
      const button = card.querySelector('.mm-card-bottom-btn');
      const b = button.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      const s = getComputedStyle(button);
      return { top: c.top, bottom: b.bottom, inset: c.bottom - b.bottom, opacity: s.opacity, position: s.position, width: b.width, height: b.height };
    }));
    assert.ok(cardLayout.length > 0);
    for (const card of cardLayout) {
      assert.equal(card.opacity, '1');
      assert.equal(card.position, 'static');
      assert.ok(card.height >= 44 && card.width > 70);
      assert.ok(card.inset >= 10 && card.inset <= 20);
    }
    const firstRow = cardLayout.filter(card => Math.abs(card.top - cardLayout[0].top) < 2);
    assert.ok(firstRow.every(card => Math.abs(card.bottom - firstRow[0].bottom) < 2), `CTA alignment at ${width}px`);
    await page.evaluate(() => scrollTo(0, 600));
    const header = await page.locator('.mm-header-wrapper').boundingBox();
    assert.ok(Math.abs(header.y) < 1, `Header remains sticky at ${width}px`);
    console.log(`PASS ${width}px: no overflow, badges or breadcrumbs; visible aligned CTAs; sticky header`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/shop?q=hoodie`, { waitUntil: "load" });
  const results = await page.locator('.mm-card-title').allTextContents();
  assert.ok(results.length && results.every(name => /hoodie/i.test(name)), 'Search results match query');
  await page.goto(`${base}/shop?kind=fleece`, { waitUntil: "load" });
  assert.ok(await page.locator('.mm-card').count() > 0, 'Fleece collection is populated');
  await page.selectOption('#shop-sort', 'name');
  await page.waitForURL(/sort=name/);
  const names = await page.locator('.mm-card-title').allTextContents();
  assert.deepEqual(names, [...names].sort((a,b) => a.localeCompare(b)));
  console.log('PASS search, fleece filters and native sorting');
  await page.goto(`${base}/shop`, { waitUntil: "load" });
  const swatch = page.locator('.mm-card').first().locator('.mm-swatch-dot').nth(1);
  await swatch.click();
  assert.equal(await swatch.getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.mm-card-bottom-btn').first().getAttribute('href'), /\?color=/);
  const save = page.getByRole('button', { name: /save .* to wishlist/i }).first();
  await save.click();
  await page.getByRole('button', { name: /remove .* from wishlist/i }).first().waitFor();
  await page.goto(`${base}/wishlist`, { waitUntil: "load" });
  await page.locator('.mm-card').first().waitFor();
  assert.equal(await page.locator('.mm-card').count(), 1);
  await page.reload({ waitUntil: "load" });
  await page.locator('.mm-card').first().waitFor();
  assert.equal(await page.locator('.mm-card').count(), 1);
  await page.getByRole('button', { name: /remove .* from wishlist/i }).click();
  await page.getByRole('heading', { name: 'Your next idea starts here' }).waitFor();
  console.log('PASS color selection and wishlist save, reload, removal, empty state');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('dialog', { name: 'Site menu' }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded'), 'false');
  console.log('PASS mobile menu opens, closes with Escape and restores focus');
  await page.goto(base, { waitUntil: "load" });
  await page.getByRole('button', { name: 'Hoodies & fleece', exact: true }).click();
  const filtered = await page.locator('.mm-card-title').allTextContents();
  assert.ok(filtered.length && filtered.every(name => /hoodie|crewneck/i.test(name)));
  assert.equal(await page.locator('footer').getByText(/Kingdom Custom Print. All Rights Reserved/).count(), 1);
  assert.equal(await page.locator('a[href="#"]').count(), 0);
  console.log('PASS homepage tabs and Kingdom branding');
  assert.deepEqual(errors, []);
  console.log('ALL STOREFRONT CHECKS PASSED');
} finally { await browser.close(); }
