import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import postgres from "postgres";
import { chromium } from "playwright";

const base = process.env.QA_BASE ?? "http://localhost:3100";
const email = `qa-polo-${Date.now()}@example.invalid`;
const password = `Temporary-${Date.now()}-Pass`;
const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator('.mm-category-link[href="/shop?kind=polo"]').waitFor();
  assert.ok(await page.locator('.mm-category-art-polo').count());
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.locator(".mm-category-strip").screenshot({ path: path.join(os.tmpdir(), "kcp-home-categories-mobile.png") });
  console.log("PASS polo category on mobile homepage");

  await page.goto(`${base}/shop?kind=tee`, { waitUntil: "domcontentloaded" });
  await page.locator(".mm-card").first().waitFor();
  assert.ok(await page.locator(".mm-card-sample-print").count() > 0);
  await page.locator(".mm-card").first().screenshot({ path: path.join(os.tmpdir(), "kcp-tee-card-mobile.png") });
  console.log("PASS sample graphic on shirt cards");

  await page.goto(`${base}/shop?kind=polo`, { waitUntil: "domcontentloaded" });
  await page.locator(".mm-card").first().waitFor();
  assert.match(await page.locator(".mm-card-title").first().innerText(), /polo/i);
  assert.equal(await page.locator(".mm-card-sample-print").count(), 1);
  await page.locator(".mm-card-media img").first().evaluate((image) => image.decode());
  await page.locator(".mm-card").first().screenshot({ path: path.join(os.tmpdir(), "kcp-polo-card-mobile.png") });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.screenshot({ path: path.join(os.tmpdir(), "kcp-polo-shop-mobile.png"), fullPage: true });
  console.log("PASS polo shop card, sample print and mobile layout");

  await page.goto(`${base}/product/classic-pique-polo`, { waitUntil: "domcontentloaded" });
  await page.locator(".pdp-thumbs li").first().waitFor();
  assert.equal(await page.locator(".pdp-thumbs li").count(), 2);
  await page.getByRole("button", { name: "View back" }).click();
  assert.equal(await page.locator(".pdp-photo-stage .product-photography").getAttribute("data-photo-view"), "back");
  console.log("PASS polo product gallery has accurate front and back views");

  await page.goto(`${base}/customize/classic-pique-polo`, { waitUntil: "domcontentloaded" });
  const photo = page.locator("image.rot-shirt-photo").first();
  await photo.waitFor();
  assert.match(await photo.getAttribute("href"), /family=polo.*view=front/);
  const front = await page.request.get(`${base}/api/garment-preview?family=polo&color=FFFFFF&view=front`);
  const back = await page.request.get(`${base}/api/garment-preview?family=polo&color=FFFFFF&view=back`);
  assert.equal(front.status(), 200);
  assert.equal(back.status(), 200);
  await page.locator('button.rot-tool[data-tool="products"]').click();
  await page.locator('.rot-garment[data-color-slug="black"]').click();
  await page.waitForFunction(() => document.querySelector("image.rot-shirt-photo")?.getAttribute("href")?.includes("color=141414"));
  await page.getByRole("button", { name: "Rotate to the back" }).click();
  assert.match(await photo.getAttribute("href"), /family=polo.*view=back/);
  console.log("PASS polo color switching and front/back studio preview");

  await page.goto(`${base}/account`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Create account" }).first().click();
  await page.getByLabel("Full name").fill("QA Polo Buyer");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).last().click();
  await page.getByRole("heading", { name: "Your account" }).waitFor({ timeout: 15000 });
  assert.match(await page.locator(".account-profile").innerText(), /QA Polo Buyer/i);
  assert.match(await page.locator(".account-orders").innerText(), /Orders/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await page.getByRole("alert").getByText("Email or password is incorrect.").waitFor();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).last().click();
  await page.getByRole("heading", { name: "Your account" }).waitFor();
  assert.match(await page.locator(".account-profile").innerText(), new RegExp(email));
  await page.screenshot({ path: path.join(os.tmpdir(), "kcp-account-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Your account" }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.screenshot({ path: path.join(os.tmpdir(), "kcp-account-desktop.png"), fullPage: true });
  console.log("PASS customer registration, session, logout and login");
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  if (process.env.DATABASE_URL) {
    const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
    try { await db`DELETE FROM customer_accounts WHERE email = ${email}`; }
    finally { await db.end(); }
  }
}
