/**
 * Background removal smoke test.
 *
 * The "Remove Background" control must work on phones as well as desktop. This
 * uploads a logo that sits on a plain background and verifies the instant
 * on-device cutout actually clears the border pixels in both layouts.
 */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const BROWSER = process.env.QA_BROWSER ?? "chrome";
const DRAFT_KEY = "kcp.draft.v3.crown-classic-tee";
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch({ channel: BROWSER, headless: true });

try {
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const mobile = viewport.width <= 900;
    const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${BASE}/customize/crown-classic-tee?color=black&sizes=M%3A1`, { waitUntil: "commit", timeout: 30000 });
    await page.locator(".rot-canvas-svg").waitFor();

    const png = Buffer.from(
      await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 420;
        c.height = 420;
        const x = c.getContext("2d");
        x.fillStyle = "#ffffff";
        x.fillRect(0, 0, 420, 420);
        x.fillStyle = "#c0392b";
        x.beginPath();
        x.arc(210, 210, 130, 0, Math.PI * 2);
        x.fill();
        return c.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    );

    await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
    await page.locator(".rot-editor").waitFor({ state: "visible" });
    await page.waitForTimeout(300);

    const toggle = page.getByRole("switch", { name: "Remove Background" });
    await toggle.scrollIntoViewIfNeeded();
    const started = Date.now();
    await toggle.click();
    await page.waitForFunction(
      (key) => {
        const design = JSON.parse(localStorage.getItem(key) ?? "null")?.design;
        const layer = design?.front?.[design.front.length - 1];
        return Boolean(layer?.backgroundRemovedSrc);
      },
      DRAFT_KEY,
      { timeout: 30000 },
    );
    const elapsed = Date.now() - started;

    const probe = await page.evaluate(async (key) => {
      const design = JSON.parse(localStorage.getItem(key)).design;
      const layer = design.front[design.front.length - 1];
      const image = new Image();
      image.src = layer.src;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const alpha = (x, y) => data[(y * canvas.width + x) * 4 + 3];
      return {
        corner: Math.max(
          alpha(2, 2),
          alpha(canvas.width - 3, 2),
          alpha(2, canvas.height - 3),
          alpha(canvas.width - 3, canvas.height - 3),
        ),
        center: alpha(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
        removeBg: Boolean(layer.fx?.removeBg),
      };
    }, DRAFT_KEY);

    const toast = await page.locator(".rot-toast").innerText().catch(() => "");
    check(`${label} background removal is instant`, elapsed < 15000, `${elapsed}ms (instant local cutout, no model download)`);
    check(`${label} clears the border pixels`, probe.corner === 0, `corner alpha ${probe.corner}`);
    check(`${label} keeps the artwork`, probe.center > 128, `center alpha ${probe.center}`);
    check(`${label} records the removal on the layer`, probe.removeBg);
    check(`${label} confirms to the customer`, /background removed/i.test(toast), toast.replace(/\s+/g, " ").trim() || "no toast");
    check(`${label} produces no browser errors`, errors.length === 0, errors.join(" | "));

    await context.close();
  }
} finally {
  await browser.close();
}

if (failures > 0) {
  console.log(`${failures} background removal check(s) failed`);
  process.exit(1);
}
console.log("ALL BACKGROUND REMOVAL CHECKS PASSED");
