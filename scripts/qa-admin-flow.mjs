/** Admin smoke test: bad password rejected, good password loads the dashboard. */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.QA_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

let failures = 0;
const check = (n, ok, d = "") => {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${n}${d ? ` — ${d}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("favicon") && errors.push(m.text()));

await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
check("login screen shown", await page.locator('input[type="password"]').count() > 0);

const categoryProbe = await fetch(`${BASE}/api/admin/categories`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "Unauthorised probe" }),
});
check(
  "category API remains protected",
  categoryProbe.status === 401 || categoryProbe.status === 503,
  `HTTP ${categoryProbe.status}`
);

if (!PASSWORD) {
  check(
    "unconfigured admin access is clearly disabled",
    await page.locator('input[type="password"]').isDisabled() &&
      await page.getByRole("button", { name: /sign in/i }).first().isDisabled()
  );
  console.log("  SKIP  sign-in checks (QA_ADMIN_PASSWORD not set)");
} else {
  await page.locator('input[type="password"]').fill("wrong-password-value");
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.locator("#admin-error").waitFor({ state: "visible", timeout: 15000 });
  const rejection = await page
    .locator(".error-text, [role=alert]")
    .first()
    .innerText()
    .catch(() => "");
  check(
    "wrong password is rejected with a visible message",
    /not correct|incorrect|invalid|not set up|too many/i.test(rejection),
    rejection.trim()
  );

  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).first().click();
  await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor({ state: "visible", timeout: 15000 });
  const dash = await page.locator("body").innerText();
  check("dashboard loads after sign-in", /orders|revenue|products|settings/i.test(dash));
  check("order table visible", /KCP-|order/i.test(dash));
  check("products panel reachable", /product/i.test(dash));
  for (const tab of ["Orders", "Products", "Customers", "Settings"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.waitForURL(new RegExp(`tab=${tab.toLowerCase()}`));
    check(`${tab} panel opens`, await page.locator("main").innerText().then(text => text.length > 100));
  }
  const api = page.context().request;
  const suffix = Date.now().toString(36);
  let categoryId;
  let productId;
  try {
    await api.get(BASE); // Prime the cached homepage before testing an admin write.
    const category = { name: "QA temporary category", slug: `qa-category-${suffix}`, description: "Temporary verification fixture", sortOrder: 999 };
    let result = await api.post(`${BASE}/api/admin/categories`, { data: category });
    categoryId = (await result.json()).id;
    check("category creation works", result.ok() && Boolean(categoryId));
    const refreshedHome = await (await api.get(BASE)).text();
    check("admin category writes refresh the cached storefront", refreshedHome.includes(`<option value="${category.slug}">`));
    result = await api.put(`${BASE}/api/admin/categories`, { data: { ...category, id: categoryId, name: "QA category edited" } });
    check("category editing works", result.ok());
    const fixture = { name: "QA temporary garment", slug: `qa-garment-${suffix}`, kind: "tee", categoryId, active: false, featured: false, basePrice: 18, compareAt: null, printFeePerSide: 4, colors: [{ slug: "black", name: "Black", hex: "#111111" }], sizes: [{ label: "M", surcharge: 0 }], priceBreaks: [] };
    result = await api.post(`${BASE}/api/admin/products`, { data: fixture });
    productId = (await result.json()).id;
    check("draft product creation works", result.ok() && Boolean(productId));
    result = await api.put(`${BASE}/api/admin/products`, { data: { ...fixture, id: productId, name: "QA garment edited", basePrice: 19 } });
    check("product editing works", result.ok());
    result = await api.patch(`${BASE}/api/admin/products`, { data: { id: productId, featured: true } });
    check("product feature toggle works", result.ok());
    result = await api.post(`${BASE}/api/admin/products`, { data: { ...fixture, slug: `qa-invalid-${suffix}`, basePrice: -1 } });
    check("invalid product price rejected", result.status() === 422);
    result = await api.get(`${BASE}/api/admin/settings`);
    check("settings can be read", result.ok() && typeof (await result.json()).shippingFlat === "number");
    result = await api.patch(`${BASE}/api/admin/orders`, { data: { reference: "QA-NONEXISTENT", status: "invalid" } });
    check("invalid order status rejected", result.status() === 422);
    for (const width of [320, 820, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      check(`admin fits ${width}px`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
  } finally {
    if (productId) check("temporary product removed", (await api.delete(`${BASE}/api/admin/products?id=${productId}`)).ok());
    if (categoryId) check("temporary category removed", (await api.delete(`${BASE}/api/admin/categories?id=${categoryId}`)).ok());
  }
  check("admin logout succeeds", (await api.post(`${BASE}/api/admin/logout`)).ok());
  check("session cannot be reused after logout", (await api.get(`${BASE}/api/admin/settings`)).status() === 401);

}

// The rejected-attempt 401 is logged by the browser as a failed request; that
// is the expected outcome of the test above, not an application error.
const realErrors = errors.filter((e) => !/401 \(Unauthorized\)/.test(e));
check("no unexpected console errors in admin", realErrors.length === 0, realErrors[0] ?? "");
await browser.close();
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
