/**
 * Hosted background removal inside the editor, end to end.
 *
 * Needs the dev server started WITH a hosted source configured, e.g.
 *
 *   PowerShell:  $env:NEXT_PUBLIC_IMGIX_SOURCE="test.imgix.net"; npm run dev
 *   bash:        NEXT_PUBLIC_IMGIX_SOURCE=test.imgix.net npm run dev
 *
 * The imgix host itself is intercepted — the render is fulfilled with a
 * synthetic cut-out — so no account, no credits and no imgix network are
 * needed. What is pinned:
 *
 *  - the request URL mirrors the rushordertees recipe plus
 *    `bg-remove-fallback=false` (never silently hand back the original photo)
 *  - the upload imgix receives is jpg/png — its remover refuses WebP
 *  - a "still processing" 423 is retried until the render is ready
 *  - the result lands on the layer as `cutoutSource: "hosted"`, corners clear
 *  - no AI model is downloaded when the hosted remover does the work
 *  - a hosted failure falls back to the on-device models and says so
 *  - flat artwork still cuts out instantly and is never uploaded anywhere
 *
 * Not part of `npm run qa-site`: it must run against a server that was started
 * with `NEXT_PUBLIC_IMGIX_SOURCE` set. On a normal server it fails the first
 * scenario and says exactly why.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const BROWSER = process.env.QA_BROWSER ?? "chrome";
const DRAFT_KEY = "kcp.draft.v3.crown-classic-tee";
/** The lab measured this one as "photograph" (see lib/imageFx.ts). */
const PHOTO = "public/cutout-samples/mug.jpg";
/** A real person — the portrait model copes with it, so the fallback is clean. */
const PORTRAIT = "public/cutout-samples/portrait-flowers.jpg";
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const flatLogo = `x.fillStyle="#ffffff";x.fillRect(0,0,420,420);x.fillStyle="#c0392b";x.beginPath();x.arc(210,210,130,0,7);x.fill();`;

/* ---- 1. The URL builder pins the recipe -------------------------------- */

{
  const output = ts.transpileModule(readFileSync("lib/imgixCutout.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, URL });
  const { imgixCutoutUrl, cleanImgixDomain } = exports;

  const built = imgixCutoutUrl("test.imgix.net", "/api/cutout-bridge/abc123");
  check(
    "the request mirrors rushordertees and refuses the silent fallback",
    built ===
      "https://test.imgix.net/api/cutout-bridge/abc123?bg-remove=true&trim=colorUnlessAlpha&fm=png&cs=strip&bg-remove-fallback=false",
    built,
  );
  check("a pasted dashboard URL is accepted", cleanImgixDomain("https://x.imgix.net/") === "x.imgix.net");
}

/* ---- helpers ----------------------------------------------------------- */

/** Model weights come from Hugging Face or arrive as .onnx files. */
function isModelDownload(raw) {
  try {
    const url = new URL(raw);
    const host = url.hostname;
    if (host === "hf.co" || host.endsWith(".hf.co")) return true;
    if (host === "huggingface.co" || host.endsWith(".huggingface.co")) return true;
    return /\.onnx(\?|$)/.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

function attachSpies(page) {
  const bridgePosts = [];
  const modelRequests = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/cutout-bridge")) {
      bridgePosts.push(request.url());
    }
    if (isModelDownload(request.url())) {
      modelRequests.push(request.url());
    }
  });
  return { bridgePosts, modelRequests };
}

async function drawPng(page, draw) {
  return Buffer.from(
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
}

async function uploadPhoto(page, file) {
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.locator(".rot-editor").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
}

async function flipRemoveBackground(page) {
  const toggle = page.getByRole("switch", { name: "Remove Background" });
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
}

async function waitForToast(page) {
  // Grab the toast as soon as it appears: it is the customer-facing answer.
  return await page
    .locator(".rot-toast")
    .first()
    .textContent({ timeout: 240000 })
    .catch(() => "");
}

async function settleDraft(page) {
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
}

async function probeLayer(page) {
  return await page.evaluate(async (key) => {
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
      hasCutout: Boolean(layer.backgroundRemovedSrc),
      cutoutSource: layer.cutoutSource ?? null,
    };
  }, DRAFT_KEY);
}

const browser = await chromium.launch({ channel: BROWSER, headless: true });
let hostedModeSeen = false;

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
      userAgent: mobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    });

    /* -------- scenario A: the hosted remover does the work -------------- */

    {
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const { bridgePosts, modelRequests } = attachSpies(page);

      await page.goto(`${BASE}/customize/crown-classic-tee?color=black&sizes=M%3A1`, {
        waitUntil: "commit",
        timeout: 30000,
      });
      await page.locator(".rot-canvas-svg").waitFor();

      // The cut-out imgix will hand back: a solid subject, clear corners.
      const cutoutPng = await drawPng(
        page,
        `x.fillStyle="#2b6cb0";x.beginPath();x.arc(210,210,150,0,7);x.fill();`,
      );
      const imgixRequests = [];
      await page.route(
        (url) => url.hostname.endsWith(".imgix.net"),
        async (route) => {
          imgixRequests.push(route.request().url());
          if (imgixRequests.length === 1) {
            // imgix's "still processing" answer for a cold photo.
            await route.fulfill({
              status: 423,
              headers: { "access-control-allow-origin": "*" },
              body: "",
            });
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: "image/png",
            headers: { "access-control-allow-origin": "*" },
            body: cutoutPng,
          });
        },
      );

      await uploadPhoto(page, PHOTO);
      const started = Date.now();
      await flipRemoveBackground(page);

      // The bridge upload is the hosted path's first step — it is also how a
      // misconfigured server run is detected early.
      const upload = await page
        .waitForRequest(
          (request) => request.method() === "POST" && request.url().includes("/api/cutout-bridge"),
          { timeout: 15000 },
        )
        .catch(() => null);
      if (!upload) {
        check(
          `${label} hosted: the server is running with a hosted source`,
          false,
          "start the dev server with NEXT_PUBLIC_IMGIX_SOURCE=test.imgix.net and re-run",
        );
        await page.close();
        continue;
      }
      hostedModeSeen = true;
      const uploadBody = upload.postDataBuffer();
      const uploadHead = uploadBody ? uploadBody.subarray(0, 4096).toString("latin1") : "";
      const uploadType = uploadHead.match(/content-type: (image\/[a-z0-9.+-]+)/i)?.[1] ?? "unknown";

      const toast = await waitForToast(page);
      const elapsed = Date.now() - started;
      await settleDraft(page);
      const probe = await probeLayer(page);
      const firstRequest = imgixRequests[0] ?? "";

      check(
        `${label} hosted: the photo is parked on our bridge for imgix`,
        bridgePosts.length === 1,
        bridgePosts[0] ?? "no bridge upload",
      );
      check(
        `${label} hosted: imgix only gets jpg/png (it refuses WebP)`,
        uploadType === "image/jpeg" || uploadType === "image/png",
        uploadType,
      );
      check(
        `${label} hosted: the imgix request carries the pinned recipe`,
        firstRequest.startsWith("https://") &&
          firstRequest.includes(".imgix.net/api/cutout-bridge/") &&
          firstRequest.includes("bg-remove=true") &&
          firstRequest.includes("trim=colorUnlessAlpha") &&
          firstRequest.includes("fm=png") &&
          firstRequest.includes("cs=strip") &&
          firstRequest.includes("bg-remove-fallback=false"),
        firstRequest,
      );
      check(
        `${label} hosted: a "still processing" answer is retried until ready`,
        imgixRequests.length === 2,
        `${imgixRequests.length} request(s) in ${elapsed}ms`,
      );
      check(
        `${label} hosted: no AI model is downloaded when the hosted AI works`,
        modelRequests.length === 0,
        modelRequests[0] ?? "none requested",
      );
      check(`${label} hosted: the cut-out lands on the layer`, probe.removeBg && probe.hasCutout);
      check(
        `${label} hosted: the layer records the hosted source`,
        probe.cutoutSource === "hosted",
        `source ${probe.cutoutSource}`,
      );
      check(`${label} hosted: the backdrop is fully cleared`, probe.corner === 0, `corner alpha ${probe.corner}`);
      check(`${label} hosted: the subject survives`, probe.center > 128, `center alpha ${probe.center}`);
      check(
        `${label} hosted: the customer is told the hosted AI did it`,
        /hosted ai/i.test(toast),
        toast.replace(/\s+/g, " ").trim() || "no toast",
      );
      check(`${label} hosted: no browser errors`, errors.length === 0, errors.join(" | "));

      await page.close();
    }

    /* -------- scenario B: hosted fails, the device answers (mobile) ----- */

    if (mobile) {
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const { bridgePosts } = attachSpies(page);

      await page.goto(`${BASE}/customize/crown-classic-tee?color=black&sizes=M%3A1`, {
        waitUntil: "commit",
        timeout: 30000,
      });
      await page.locator(".rot-canvas-svg").waitFor();

      const imgixRequests = [];
      await page.route(
        (url) => url.hostname.endsWith(".imgix.net"),
        async (route) => {
          imgixRequests.push(route.request().url());
          await route.fulfill({
            status: 500,
            headers: { "access-control-allow-origin": "*" },
            body: "",
          });
        },
      );

      await uploadPhoto(page, PORTRAIT);
      await flipRemoveBackground(page);

      const uploadSeen = await page
        .waitForRequest(
          (request) => request.method() === "POST" && request.url().includes("/api/cutout-bridge"),
          { timeout: 15000 },
        )
        .then(() => true)
        .catch(() => false);

      // The portrait model (6 MB) takes over from here.
      const toast = await waitForToast(page);
      await settleDraft(page);
      const probe = await probeLayer(page);

      check(
        `${label} fallback: the hosted remover was tried first`,
        uploadSeen && imgixRequests.length >= 1,
        `${bridgePosts.length} upload(s), ${imgixRequests.length} render request(s)`,
      );
      check(
        `${label} fallback: the result is not a hosted one`,
        probe.cutoutSource !== "hosted",
        `source ${probe.cutoutSource}`,
      );
      if (probe.hasCutout) {
        check(
          `${label} fallback: the customer is told the device handled it`,
          /background removed/i.test(toast) && /hosted ai did not answer/i.test(toast),
          toast.replace(/\s+/g, " ").trim() || "no toast",
        );
      } else {
        check(
          `${label} fallback: refusal stays honest`,
          /could not find a subject|could not detect a background/i.test(toast),
          toast.replace(/\s+/g, " ").trim() || "no toast",
        );
      }
      check(
        `${label} fallback: nothing half-removed is pasted`,
        probe.corner === 255 || probe.hasCutout,
        `corner alpha ${probe.corner}`,
      );
      check(`${label} fallback: no browser errors`, errors.length === 0, errors.join(" | "));

      await page.close();
    }

    /* -------- scenario C: flat artwork never leaves the browser --------- */

    if (!mobile) {
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const { bridgePosts } = attachSpies(page);

      await page.goto(`${BASE}/customize/crown-classic-tee?color=black&sizes=M%3A1`, {
        waitUntil: "commit",
        timeout: 30000,
      });
      await page.locator(".rot-canvas-svg").waitFor();

      const imgixRequests = [];
      await page.route(
        (url) => url.hostname.endsWith(".imgix.net"),
        async (route) => {
          imgixRequests.push(route.request().url());
          await route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "" });
        },
      );

      const png = await drawPng(page, flatLogo);
      await page.locator('input[type="file"]').setInputFiles({
        name: "flat-logo.png",
        mimeType: "image/png",
        buffer: png,
      });
      await page.locator(".rot-editor").waitFor({ state: "visible" });
      await page.waitForTimeout(300);

      const started = Date.now();
      await flipRemoveBackground(page);
      const toast = await waitForToast(page);
      const elapsed = Date.now() - started;
      await settleDraft(page);
      const probe = await probeLayer(page);

      check(
        `${label} flat: cut out instantly, with no upload at all`,
        elapsed < 8000 && probe.cutoutSource === "quick",
        `${elapsed}ms, source ${probe.cutoutSource}`,
      );
      check(
        `${label} flat: nothing was parked on the bridge`,
        bridgePosts.length === 0,
        `${bridgePosts.length} upload(s)`,
      );
      check(
        `${label} flat: imgix was never asked`,
        imgixRequests.length === 0,
        imgixRequests[0] ?? "none",
      );
      check(`${label} flat: backdrop cleared, artwork intact`, probe.corner === 0 && probe.center > 128, `corner ${probe.corner}, center ${probe.center}`);
      check(`${label} flat: customer is told it worked`, /background removed/i.test(toast), toast.replace(/\s+/g, " ").trim() || "no toast");
      check(`${label} flat: no browser errors`, errors.length === 0, errors.join(" | "));

      await page.close();
    }

    await context.close();
  }
} finally {
  await browser.close();
}

if (!hostedModeSeen) {
  console.log(
    "\nThe server never used the hosted path. Start it with NEXT_PUBLIC_IMGIX_SOURCE=test.imgix.net and re-run.",
  );
}

if (failures > 0) {
  console.log(`${failures} hosted cut-out check(s) failed`);
  process.exit(1);
}
console.log("ALL HOSTED CUT-OUT CHECKS PASSED");
