/**
 * End-to-end cart + customizer smoke test.
 *
 * Exercises the real browser flows a customer takes: design a garment, add it to
 * the cart, change the size run, reload, and check out. Asserts on what the
 * customer actually sees rather than on internal state.
 */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const PRODUCT_SLUG = process.env.QA_PRODUCT_SLUG ?? "crown-classic-tee";
const PRODUCT_NAME = (process.env.QA_PRODUCT_NAME ?? "Crown Classic").toLowerCase();

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const money = (s) => Number((s ?? "").replace(/[^0-9.]/g, ""));

const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on("response", async (r) => {
  if (r.url().includes("/api/checkout")) {
    console.log(`    API ${r.status()} ${(await r.text()).slice(0, 200)}`);
  }
});
page.on("requestfailed", (r) => console.log("    REQ FAILED", r.url(), r.failure()?.errorText));
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text());
});

/* ---- 1. Add a designed garment to the cart ---- */
console.log("\n1. customizer add-to-cart");
await page.goto(`${BASE}/customize/${PRODUCT_SLUG}`, { waitUntil: "networkidle" });

const addText = page.getByRole("button", { name: /^add text$/i }).first();
await addText.click();
await page.waitForTimeout(400);

const layerPreview = page.locator('.rot-canvas-svg[aria-label*="1 design element"]');
check("text layer appears in preview", await layerPreview.count() > 0, `${await page.locator('.rot-canvas-svg').count()} preview`);

// Sizes live behind the Quantity step on this flow.
await page.getByRole("button", { name: /^next$/i }).first().click();
await page.waitForTimeout(800);
const qtyInput = page.locator('input[id^="q-"]').first();
await qtyInput.waitFor({ state: "visible", timeout: 15000 });
await qtyInput.fill("2");
await page.waitForTimeout(600);

const canvas = await page.locator(".rot-canvas").first().boundingBox();
check("design canvas rendered", !!canvas && canvas.width > 200, canvas ? `${Math.round(canvas.width)}×${Math.round(canvas.height)}` : "missing");

await page.getByRole("button", { name: /^next$/i }).first().click();
await page.waitForTimeout(700);
await page.getByRole("button", { name: /^add to cart$/i }).first().click();
await page.waitForTimeout(1800);

const cartCount = await page
  .locator('header a[href="/cart"]')
  .first()
  .innerText();
check("cart badge shows a count", /\d/.test(cartCount), cartCount.trim().slice(0, 20));

/* ---- 2. Cart reflects the configured design ---- */
console.log("\n2. cart contents");
await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
const cartText = await page.locator("main, body").first().innerText();

check("cart shows the product", cartText.toLowerCase().includes(PRODUCT_NAME));
const designSummary = cartText.match(/front:\s*\d+\s*\w+/i) ?? cartText.match(/blank/i);
check("cart records the design", !!designSummary, designSummary?.[0] ?? "no design summary");
const cartTotal = money((cartText.match(/subtotal[\s\S]{0,60}?(\d+\.\d{2})/i) ?? [])[1]);
check("subtotal is a positive amount", cartTotal > 0, `$${cartTotal}`);

/* ---- 3. Cart survives a reload (localStorage) ---- */
console.log("\n3. persistence across reload");
await page.reload({ waitUntil: "networkidle" });
const afterReload = await page.locator("main, body").first().innerText();
check("cart still populated after reload", afterReload.toLowerCase().includes(PRODUCT_NAME));

/* ---- 4. Size quantity change reprices correctly ---- */
console.log("\n4. repricing on size change");
const stepperUp = page.locator('button[aria-label^="Increase"]').first();
let repriced = false;
if (await stepperUp.count()) {
  const before = money((afterReload.match(/subtotal[\s\S]{0,60}?(\d+\.\d{2})/i) ?? [])[1]);
  await stepperUp.click();
  await page.waitForTimeout(700);
  const nowText = await page.locator("main, body").first().innerText();
  const after = money((nowText.match(/subtotal[\s\S]{0,60}?(\d+\.\d{2})/i) ?? [])[1]);
  repriced = after > before;
  check("subtotal increases when quantity increases", repriced, `$${before} → $${after}`);
} else {
  check("size stepper present", false, "not found");
}

/* ---- 5. Checkout accepts the cart ---- */
console.log("\n5. checkout submission");
await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
const hasForm = await page.locator("form, input[type=email]").count();
check("checkout form renders", hasForm > 0);

const email = page.locator('input[name="email"], input[type="email"]').first();
const paymentUnavailable = await page.getByRole("button", { name: "Card checkout unavailable" }).count();
if (paymentUnavailable) {
  check("checkout is disabled until Stripe is configured", await page.getByRole("button", { name: "Card checkout unavailable" }).isDisabled());
  const gate = await fetch(`${BASE}/api/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: [] }) });
  check("API rejects unconfigured payments", gate.status === 503);
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  check("cart stays saved while payments are unavailable", (await page.locator("main").innerText()).toLowerCase().includes(PRODUCT_NAME));
} else if (await email.count()) {
  // Type each field the way a customer would; the dev server needs a moment to
  // compile the checkout route on the first request.
  const typeInto = async (sel, text) => {
    const el = page.locator(sel);
    await el.waitFor({ state: "visible", timeout: 15000 });
    await el.click();
    await el.fill("");
    await el.type(text, { delay: 12 });
  };
  await typeInto("#email", "qa-e2e@example.com");
  await typeInto("#name", "QA E2E");
  await typeInto("#addressLine1", "1 Test Street");
  await typeInto("#city", "Austin");
  await typeInto("#region", "TX");
  await typeInto("#postal", "78701");
  await page.waitForTimeout(400);
  const submit = page.getByRole("button", { name: /place order|pay|checkout/i }).first();
  await submit.click();
  // Dev-mode route compilation is slow on a cold submit; wait for the result
  // state rather than a fixed delay.
  await page
    .locator("text=/KCP-[A-Z0-9]{6}/")
    .first()
    .waitFor({ state: "visible", timeout: 60000 })
    .catch(() => {});
  await page.waitForTimeout(600);
  const resultText = await page.locator("main, body").first().innerText();
  if (!/KCP-[A-Z0-9]{6}/.test(resultText)) {
    const formErr = await page.locator(".form-error, [role=alert], .field-error").allInnerTexts().catch(() => []);
    console.log("    form errors:", JSON.stringify(formErr));
    console.log("    tail:", resultText.replace(/\s+/g, " ").slice(-300));
  }
  const ref = (resultText.match(/KCP-[A-Z0-9]{6}/) ?? [])[0];
  check("checkout produces an order reference", !!ref, ref ?? resultText.slice(0, 120));
  check("no client-side errors during checkout", errors.length === 0, errors[0] ?? "");
  if (ref) {
    await page.goto(`${BASE}/order/${ref}`, { waitUntil: "networkidle" });
    const orderText = await page.locator("main, body").first().innerText();
    check("order detail renders after checkout", orderText.includes(ref) && orderText.toLowerCase().includes(PRODUCT_NAME));

    await page.goto(`${BASE}/order/success?ref=${ref}`, { waitUntil: "networkidle" });
    const successText = await page.locator("main, body").first().innerText();
    const successCopyIsExplicit =
      /waiting for payment confirmation|payment is confirmed/i.test(successText);
    check("order success explains the payment state", successCopyIsExplicit, successText.replace(/\s+/g, " ").slice(0, 240));

    await page.goto(`${BASE}/track`, { waitUntil: "networkidle" });
    await page.locator("#track-ref").fill(ref);
    await page.getByRole("button", { name: /track order/i }).click();
    await page.waitForURL(new RegExp(`/order/${ref}$`), { timeout: 15000 });
    check("track order resolves the reference", page.url().endsWith(`/order/${ref}`));
  }
  console.log(`    order reference for cleanup: ${ref ?? "none"}`);
}

await browser.close();
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
