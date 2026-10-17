/**
 * AI background removal on a real photo.
 *
 * This is the check that matches what customers actually do: upload a photo of
 * a person against a busy background (sky, sea, trees — no flat colour in
 * sight) and ask for the background to go. The instant cut-out cannot do that
 * job at all, so this exercises the on-device model path, on a desktop browser
 * and — most importantly — on a phone-sized one with a phone user agent.
 *
 * The photo is fetched at run time (it is somebody's portrait, so it is not
 * committed). Point `QA_CUTOUT_PHOTO` at a local file to run offline:
 *
 *   QA_CUTOUT_PHOTO=./me.jpg node scripts/qa-cutout-ai.mjs
 *
 * Downloads ~6 MB of model weights per browser context, then caches them.
 */
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const BROWSER = process.env.QA_BROWSER ?? "chrome";
const DRAFT_KEY = "kcp.draft.v3.crown-classic-tee";
const PHOTO_URL = process.env.QA_CUTOUT_PHOTO_URL ?? "https://picsum.photos/id/1005/900/1200";
const OUT = path.join(os.tmpdir(), "opencode", "cutout");
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

/** The customer's photo: a person against a busy sky/sea backdrop. */
async function loadPhoto() {
  const local = process.env.QA_CUTOUT_PHOTO;
  if (local) return readFile(path.resolve(local));
  await mkdir(OUT, { recursive: true });
  const cached = path.join(OUT, "portrait.jpg");
  try {
    return await readFile(cached);
  } catch {
    const response = await fetch(PHOTO_URL);
    if (!response.ok) throw new Error(`could not fetch the test photo (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(cached, bytes);
    return bytes;
  }
}

const photo = await loadPhoto().catch((error) => {
  console.log(`FAIL test photo unavailable — ${error.message}`);
  process.exit(1);
});
console.log(`photo: ${(photo.length / 1024).toFixed(0)} KB`);

const browser = await chromium.launch({ channel: BROWSER, headless: true });

try {
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["phone", { width: 390, height: 844 }],
  ]) {
    const mobile = viewport.width <= 900;
    const context = await browser.newContext({
      viewport,
      hasTouch: mobile,
      isMobile: mobile,
      userAgent: mobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${BASE}/customize/crown-classic-tee?color=black&sizes=M%3A1`, { waitUntil: "commit", timeout: 60000 });
    await page.locator(".rot-canvas-svg").waitFor();

    await page.locator('input[type="file"]').setInputFiles({ name: "portrait.jpg", mimeType: "image/jpeg", buffer: photo });
    await page.locator(".rot-editor").waitFor({ state: "visible" });
    await page.waitForTimeout(300);

    const toggle = page.getByRole("switch", { name: "Remove Background" });
    await toggle.scrollIntoViewIfNeeded();
    const started = Date.now();
    await toggle.click();

    // The customer-facing answer, captured while it is on screen.
    const toast = await page
      .locator(".rot-toast")
      .first()
      .textContent({ timeout: 240000 })
      .catch(() => "");
    const elapsed = Date.now() - started;

    await page
      .waitForFunction(
        (key) => {
          const design = JSON.parse(localStorage.getItem(key) ?? "null")?.design;
          const layer = design?.front?.[design.front.length - 1];
          return Boolean(layer?.fx?.removeBg);
        },
        DRAFT_KEY,
        { timeout: 30000 },
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
      const row = (y) => {
        let sum = 0;
        for (let x = 0; x < canvas.width; x++) sum += alpha(x, y) > 128 ? 1 : 0;
        return sum / canvas.width;
      };
      let clear = 0;
      let soft = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] <= 8) clear += 1;
        else if (data[i] < 247) soft += 1;
      }
      // The longest unbroken opaque stretch down the middle of the picture: for
      // any portrait it runs from the head through the body, and a cut-out that
      // ate the subject breaks it up.
      const centreX = Math.floor(canvas.width / 2);
      let run = 0;
      let longest = 0;
      for (let y = 0; y < canvas.height; y++) {
        if (alpha(centreX, y) > 128) {
          run += 1;
          if (run > longest) longest = run;
        } else run = 0;
      }
      return {
        width: canvas.width,
        height: canvas.height,
        corner: Math.max(
          alpha(2, 2),
          alpha(canvas.width - 3, 2),
          alpha(2, canvas.height - 3),
          alpha(canvas.width - 3, canvas.height - 3),
        ),
        // Where the subject is: the middle of the picture (a person's back).
        centre: alpha(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
        centreRun: +(longest / canvas.height).toFixed(3),
        // The top band of both test photos is pure backdrop.
        skyRow: row(4),
        keptPct: +((100 * (data.length / 4 - clear)) / (data.length / 4)).toFixed(1),
        clearPct: +((100 * clear) / (canvas.width * canvas.height)).toFixed(1),
        softPct: +((100 * soft) / (canvas.width * canvas.height)).toFixed(1),
        cutoutSource: layer.cutoutSource ?? null,
        hasCutout: Boolean(layer.backgroundRemovedSrc),
      };
    }, DRAFT_KEY);

    const name = `${label} portrait`;
    check(`${name}: the AI cut-out ran`, probe.cutoutSource === "portrait" || probe.cutoutSource === "general", `source ${probe.cutoutSource}, ${(elapsed / 1000).toFixed(1)}s`);
    check(`${name}: a cut-out is stored on the layer`, probe.hasCutout);
    check(`${name}: the busy backdrop is gone`, probe.corner === 0, `corner alpha ${probe.corner}, ${probe.clearPct}% cleared`);
    check(`${name}: the sky band is cleared`, probe.skyRow <= 0.1, `${(100 * probe.skyRow).toFixed(1)}% of the top row kept`);
    check(
      `${name}: the subject survives`,
      probe.centre > 128 && probe.centreRun >= 0.5,
      `centre alpha ${probe.centre}, opaque for ${(100 * probe.centreRun).toFixed(0)}% of the middle column`,
    );
    check(
      `${name}: the subject is not swallowed with the backdrop`,
      probe.keptPct >= 20 && probe.keptPct <= 70,
      `${probe.keptPct}% of the picture kept`,
    );
    check(
      `${name}: soft edges are preserved, not posterised`,
      probe.softPct >= 0.5 && probe.clearPct + probe.softPct < 99,
      `${probe.softPct}% soft`,
    );
    check(`${name}: customer is told it worked`, /background removed/i.test(toast), toast.replace(/\s+/g, " ").trim() || "no toast");
    check(`${name}: no browser errors`, errors.length === 0, errors.join(" | "));

    // One control only: the Remove Background switch — no "Select Object"
    // tab, no model-upgrade offers, no AI badges.
    const switches = await page.getByRole("switch", { name: "Remove Background" }).count();
    const extras = await page
      .getByText(/select object|improve cut|detailed model|try the ai/i)
      .count()
      .catch(() => 0);
    const aiBadges = await page.locator(".rot-editor .rot-badge").count();
    check(
      `${name}: one background-removal control, no extra offers`,
      switches === 1 && extras === 0 && aiBadges === 0,
      `${switches} switch(es), ${extras} extra offer(s), ${aiBadges} badge(s)`,
    );

    // Switching it off and on again must reuse the stored cut-out: same
    // pixels, same source, no second run and no second model download.
    const before = await page.evaluate((key) => {
      const layer = JSON.parse(localStorage.getItem(key)).design.front.at(-1);
      return { cached: layer.backgroundRemovedSrc ?? null, src: layer.src, cutoutSource: layer.cutoutSource ?? null };
    }, DRAFT_KEY);
    await page.getByRole("switch", { name: "Remove Background" }).click(); // off
    await page
      .waitForFunction(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.design?.front?.at(-1)?.fx?.removeBg === false,
        DRAFT_KEY,
        { timeout: 15000 },
      )
      .catch(() => {});
    await page
      .waitForFunction(
        () => /original background restored/i.test(document.querySelector(".rot-toast")?.textContent ?? ""),
        undefined,
        { timeout: 5000 },
      )
      .catch(() => {});
    const offToast = await page.locator(".rot-toast").first().textContent().catch(() => "");
    const again = Date.now();
    await page.getByRole("switch", { name: "Remove Background" }).click(); // on
    await page
      .waitForFunction(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null")?.design?.front?.at(-1)?.fx?.removeBg === true,
        DRAFT_KEY,
        { timeout: 15000 },
      )
      .catch(() => {});
    const reShownMs = Date.now() - again;
    await page.waitForTimeout(300);
    await page
      .waitForFunction(
        () => /background removed/i.test(document.querySelector(".rot-toast")?.textContent ?? ""),
        undefined,
        { timeout: 5000 },
      )
      .catch(() => {});
    const after = await page.evaluate((key) => {
      const layer = JSON.parse(localStorage.getItem(key)).design.front.at(-1);
      return { cached: layer.backgroundRemovedSrc ?? null, src: layer.src, cutoutSource: layer.cutoutSource ?? null };
    }, DRAFT_KEY);
    const onToast = await page.locator(".rot-toast").first().textContent().catch(() => "");

    check(
      `${name}: switching off restores the original and keeps the cut-out`,
      /original background restored/i.test(offToast ?? "") && after.cached === before.cached,
      (offToast ?? "").trim() || "no toast",
    );
    check(
      `${name}: switching on reuses it instantly — no second run`,
      after.src === before.src && after.cutoutSource === before.cutoutSource && reShownMs < 4000,
      `back in ${reShownMs}ms, source ${after.cutoutSource}`,
    );
    check(
      `${name}: the re-shown result says the background is removed`,
      /background removed/i.test(onToast ?? ""),
      (onToast ?? "").trim() || "no toast",
    );

    await page.close();
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures > 0) {
  console.log(`${failures} AI cut-out check(s) failed`);
  process.exit(1);
}
console.log("ALL AI CUT-OUT CHECKS PASSED");
