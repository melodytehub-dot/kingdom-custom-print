import { chromium } from "playwright";

const base = process.env.QA_BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.goto(`${base}/customize/crown-classic-tee?color=black`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('.rot');
    await page.getByRole("button", { name: "Undo", exact: true }).first().waitFor();
    await page.waitForTimeout(600);
    if (await page.getByRole("button", { name: "Undo", exact: true }).first().isEnabled()) throw new Error("Undo is enabled for a new blank design");
    await page.getByRole("button", { name: /^add text$/i }).first().click();
    await page.locator(".rot-panel .rot-textarea").first().fill("Restored design");
    await page.locator(".rot-panel").getByRole("button", { name: /\+\s*add text/i }).first().click();
    await page.waitForTimeout(800);
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem("kcp.draft.v3.crown-classic-tee")));
    if (!draft.design.front.length) throw new Error("Design was not saved");
    await page.evaluate((draft) => {
      localStorage.setItem("kcp.cart.v1", JSON.stringify([{ id: "restore-test", productSlug: "crown-classic-tee", productName: "Crown Classic Tee", productKind: "tee", colorSlug: "black", colorName: "Black", colorHex: "#111111", design: draft.design, lines: [{ label: "M", qty: 2 }], quantity: 2, unitPrice: 10, total: 20, surcharges: {}, createdAt: Date.now() }]));
    }, draft);
    await page.goto(`${base}/customize/crown-classic-tee?cartItem=restore-test`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => new URL(location.href).searchParams.get("color") === "black");
    if (await page.getByRole("dialog", { name: /continue your design/i }).count()) throw new Error("Cart edit incorrectly prompted for a draft");
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("kcp.draft.v3.crown-classic-tee")));
    if (restored.lines.M !== 2 || !restored.design.front.some((layer) => layer.text === "Restored design")) throw new Error("Cart design or sizes not restored");
    await page.locator(".rot-step").nth(1).click();
    await page.locator("#q-M").fill("3");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("kcp.draft.v3.crown-classic-tee") ?? "{}").lines?.M === 3);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => new URL(location.href).searchParams.get("cartItem") === "restore-test");
    await page.locator(".rot-step").nth(1).click();
    if (await page.locator("#q-M").inputValue() !== "3") throw new Error("Cart edits were lost on reload");
    await page.locator(".rot-step").nth(2).click();
    await page.getByRole("button", { name: /update cart/i }).filter({ visible: true }).first().click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("kcp.cart.v1") ?? "[]")[0]?.previewFront);
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("kcp.cart.v1") ?? "[]"));
    if (cart.length !== 1 || cart[0].id !== "restore-test" || cart[0].colorSlug !== "black" || cart[0].quantity !== 3) throw new Error("Editing the cart created a duplicate or lost changes");
    await page.goto(`${base}/customize/crown-classic-tee`, { waitUntil: "domcontentloaded" });
    const dialog = page.getByRole("dialog", { name: /continue your design/i });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: /continue designing/i }).click();
    if (await dialog.count()) throw new Error("Resume dialog did not close");
    await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
    const homeDialog = page.getByRole("dialog", { name: /continue your design/i });
    await homeDialog.waitFor();
    await homeDialog.getByRole("link", { name: /continue designing/i }).click();
    await page.waitForURL(/\/customize\/crown-classic-tee/);
    await page.waitForTimeout(500);
    if (await page.getByRole("dialog", { name: /continue your design/i }).count()) throw new Error("Resume prompted twice");
    console.log(`PASS restore and resume ${viewport.width}px`);
    await context.close();
  }
} finally { await browser.close(); }
