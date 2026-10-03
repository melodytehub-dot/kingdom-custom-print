/** Admin smoke test: bad password rejected, good password loads the dashboard. */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.QA_ADMIN_PASSWORD;
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
  await page.waitForTimeout(1500);
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
  await page.waitForTimeout(4000);
  const dash = await page.locator("body").innerText();
  check("dashboard loads after sign-in", /orders|revenue|products|settings/i.test(dash));
  check("order table visible", /KCP-|order/i.test(dash));
  check("products panel reachable", /product/i.test(dash));
}

// The rejected-attempt 401 is logged by the browser as a failed request; that
// is the expected outcome of the test above, not an application error.
const realErrors = errors.filter((e) => !/401 \(Unauthorized\)/.test(e));
check("no unexpected console errors in admin", realErrors.length === 0, realErrors[0] ?? "");
await browser.close();
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
