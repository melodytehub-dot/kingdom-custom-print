import { chromium } from "playwright";

const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
const base = process.env.QA_BASE ?? "http://localhost:3005";
try {
  for (const width of [320, 390, 700, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, extraHTTPHeaders: { "x-forwarded-for": `qa-admin-${Date.now()}-${width}` } });
    await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.locator('input[type="password"]').fill("LocalTestingOnly2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor({ timeout: 60000 });
    if (width <= 767) {
      const toggle = page.getByRole("button", { name: /^menu/i });
      await toggle.click();
      await page.keyboard.press("Escape");
      if (await toggle.getAttribute("aria-expanded") !== "false" || !await toggle.evaluate((node) => node === document.activeElement)) throw new Error("Menu did not close and restore focus on Escape");
    }
    const openTab = async (tab) => {
      if (width <= 767) {
        await page.getByRole("button", { name: /^menu/i }).click();
        if (await page.getByRole("button", { name: /^menu/i }).getAttribute("aria-expanded") !== "true") throw new Error("Admin menu did not open");
        if (tab === "Overview") await page.screenshot({ path: `${process.env.TEMP}/kcp-admin-menu-${width}.png` });
      }
      await page.getByRole("navigation", { name: "Dashboard sections" }).getByRole("button", { name: tab, exact: true }).click();
    };
    for (const tab of ["Overview", "Orders", "Products", "Customers", "Settings"]) {
      await openTab(tab);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw new Error(`${tab} overflows at ${width}px`);
    }
    if (await page.getByRole("button", { name: "Payment", exact: true }).count()) throw new Error("Payment tab remains visible");
    if (await page.locator(".mm-header-wrapper").count() || await page.locator(".mm-footer").count()) throw new Error("Storefront navigation appears in admin");
    await openTab("Products");
    await page.locator(".product-admin-row").first().getByRole("button", { name: "Edit", exact: true }).click();
    await page.waitForURL(/tab=products&edit=/);
    await page.getByRole("region", { name: "Product editor" }).waitFor();
    if (await page.locator(".product-admin-list").count()) throw new Error("Product list remains on edit screen");
    await page.getByRole("button", { name: "Back to products" }).click();
    await page.locator(".product-admin-list").waitFor();
    await page.getByRole("button", { name: "New product" }).click();
    await page.getByRole("region", { name: "Product editor" }).waitFor();
    await page.getByRole("button", { name: "Add color" }).click();
    await page.getByLabel("Color name").last().fill("Forest Green");
    if (await page.locator("#c-slug-1").count()) throw new Error("Technical color slug is exposed");
    await page.getByLabel("Swatch color").last().fill("#224c35");
    await page.getByRole("button", { name: "Back to products" }).click();
    await page.locator(".product-admin-list").waitFor();
    await openTab("Orders");
    await page.getByRole("searchbox", { name: "Search orders" }).fill("nonexistent order");
    await page.getByText("No matching orders").waitFor();
    await page.screenshot({ path: `${process.env.TEMP}/kcp-admin-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.close();
    console.log(`PASS admin navigation, search and layout at ${width}px`);
  }
} finally { await browser.close(); }
