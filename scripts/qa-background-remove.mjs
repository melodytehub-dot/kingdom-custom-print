/**
 * Background removal: the instant, download-free path.
 *
 * Flat artwork — a logo on white, artwork on a gradient — must be cut out
 * instantly, on every device, without downloading a model: that is what keeps
 * "Remove Background" usable on a phone with no wifi. Artwork that the instant
 * pass cannot key out (a busy photo) must not be pasted onto the shirt with a
 * half-removed backdrop; it goes to the AI models instead, and whatever happens
 * there, the customer is told the truth.
 *
 * The AI models themselves are covered by `qa-cutout-ai.mjs` (real photo, both
 * viewports) and `qa-cutout-mask.mjs` (the mask analyser).
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

/** Deterministic 420x420 artworks drawn in the page. */
const ARTWORKS = {
  "flat logo": `x.fillStyle="#ffffff";x.fillRect(0,0,420,420);x.fillStyle="#c0392b";x.beginPath();x.arc(210,210,130,0,7);x.fill();`,
  "gradient logo": `const g=x.createLinearGradient(0,0,420,420);g.addColorStop(0,"#ffffff");g.addColorStop(1,"#c8ccd2");x.fillStyle=g;x.fillRect(0,0,420,420);x.fillStyle="#1b2a4a";x.beginPath();x.arc(210,210,130,0,7);x.fill();`,
  "busy photo": `for(let i=0;i<420;i+=14){for(let j=0;j<420;j+=14){x.fillStyle="rgb("+(60+((i*7+j*13)%150))+","+(70+((i*11+j*3)%140))+","+(90+((i*5+j*17)%130))+")";x.fillRect(i,j,14,14);}}x.fillStyle="#202020";x.beginPath();x.ellipse(210,210,120,150,0,0,7);x.fill();`,
};

const browser = await chromium.launch({ channel: BROWSER, headless: true });

try {
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const mobile = viewport.width <= 900;
    const context = await browser.newContext({
      viewport,
      hasTouch: mobile,
      isMobile: mobile,
      // A phone user agent matters: phones only run the 6 MB portrait model, so
      // the download this test waits for stays small.
      userAgent: mobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    });

    for (const [artwork, draw] of Object.entries(ARTWORKS)) {
      const shouldRemove = artwork !== "busy photo";
      // The busy photo only runs on phones here, where the cascade stops at the
      // 6 MB portrait model. Desktop's fallback to the 42 MB general model is
      // covered against a real photo in qa-cutout-ai.mjs.
      if (!shouldRemove && !mobile) continue;
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto(`${BASE}/customize/crown-classic-tee?color=black&sizes=M%3A1`, { waitUntil: "commit", timeout: 30000 });
      await page.locator(".rot-canvas-svg").waitFor();

      const png = Buffer.from(
        await page.evaluate((src) => {
          const c = document.createElement("canvas");
          c.width = 420;
          c.height = 420;
          const x = c.getContext("2d");
          // eslint-disable-next-line no-new-func
          new Function("x", src)(x);
          return c.toDataURL("image/png").split(",")[1];
        }, draw),
        "base64",
      );

      await page.locator('input[type="file"]').setInputFiles({ name: `${artwork}.png`, mimeType: "image/png", buffer: png });
      await page.locator(".rot-editor").waitFor({ state: "visible" });
      await page.waitForTimeout(300);

      const toggle = page.getByRole("switch", { name: "Remove Background" });
      await toggle.scrollIntoViewIfNeeded();
      const started = Date.now();
      await toggle.click();
      // Grab the toast as soon as it appears: it is the customer-facing answer.
      const toast = await page
        .locator(".rot-toast")
        .first()
        .textContent({ timeout: 240000 })
        .catch(() => "");
      const elapsed = Date.now() - started;
      // The layer is patched just before the toast, but the draft save is debounced.
      await page
        .waitForFunction(
          (key) => {
            const design = JSON.parse(localStorage.getItem(key) ?? "null")?.design;
            const layer = design?.front?.[design.front.length - 1];
            return Boolean(layer?.fx?.removeBg);
          },
          DRAFT_KEY,
          { timeout: 10000 },
        )
        .catch(() => {});

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
        let clear = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] === 0) clear++;
        return {
          corner: Math.max(
            alpha(2, 2),
            alpha(canvas.width - 3, 2),
            alpha(2, canvas.height - 3),
            alpha(canvas.width - 3, canvas.height - 3),
          ),
          center: alpha(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
          clearPct: +((100 * clear) / (canvas.width * canvas.height)).toFixed(1),
          removeBg: Boolean(layer.fx?.removeBg),
          hasCutout: Boolean(layer.backgroundRemovedSrc),
          cutoutSource: layer.cutoutSource ?? null,
        };
      }, DRAFT_KEY);

      const name = `${label} ${artwork}`;
      if (shouldRemove) {
        check(
          `${name}: cut out instantly, with no model download`,
          elapsed < 8000 && probe.cutoutSource === "quick",
          `${elapsed}ms, source ${probe.cutoutSource}`,
        );
        check(`${name}: backdrop is fully cleared`, probe.corner === 0, `corner alpha ${probe.corner}, ${probe.clearPct}% cleared`);
        check(`${name}: artwork survives`, probe.center > 128, `center alpha ${probe.center}`);
        check(`${name}: removal is recorded on the layer`, probe.removeBg && probe.hasCutout);
        check(`${name}: customer is told it worked`, /background removed/i.test(toast), toast.replace(/\s+/g, " ").trim() || "no toast");
      } else {
        // A photo with no keyable backdrop: the instant pass must not invent a
        // cut-out, and whatever the AI does, the layer and the message agree.
        check(`${name}: the instant pass invents nothing`, probe.cutoutSource !== "quick", `source ${probe.cutoutSource}`);
        if (probe.hasCutout) {
          check(
            `${name}: a model cut it out and said so`,
            (probe.cutoutSource === "portrait" || probe.cutoutSource === "general") && /background removed/i.test(toast),
            `source ${probe.cutoutSource} — ${toast.replace(/\s+/g, " ").trim() || "no toast"}`,
          );
        } else {
          check(`${name}: refused honestly`, /could not find a subject|could not detect a background/i.test(toast), toast.replace(/\s+/g, " ").trim() || "no toast");
        }
        check(`${name}: nothing is pasted half-removed`, probe.corner === 255 || probe.hasCutout, `corner alpha ${probe.corner}`);
      }
      check(`${name}: no browser errors`, errors.length === 0, errors.join(" | "));
      await page.close();
    }

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
