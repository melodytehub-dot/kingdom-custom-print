/**
 * The Photoroom comparison row inside the editor, end to end.
 *
 * Needs the dev server started WITH the comparison engine configured, e.g.
 *
 *   PowerShell:
 *     $env:NEXT_PUBLIC_IMGIX_SOURCE="test.imgix.net"
 *     $env:NEXT_PUBLIC_CUTOUT_ALT="photoroom"
 *     $env:PHOTOROOM_API_KEY="test-key-123"
 *     $env:PHOTOROOM_API_URL="http://127.0.0.1:3971"
 *     npm run dev
 *   bash:
 *     NEXT_PUBLIC_IMGIX_SOURCE=test.imgix.net NEXT_PUBLIC_CUTOUT_ALT=photoroom \
 *       PHOTOROOM_API_KEY=test-key-123 PHOTOROOM_API_URL=http://127.0.0.1:3971 npm run dev
 *
 * Nothing billable happens: imgix is fulfilled in-page and Photoroom by a
 * local mock this script starts on 127.0.0.1:3971. What is pinned:
 *
 *  - the row is offered whenever the build carries the alt engine
 *  - a tap prepares a JPEG (never the editor's WebP copy) and posts it to our
 *    own /api/photoroom-cutout route — the API key stays on the server and
 *    never appears in any browser request
 *  - the mock service receives exactly the documented contract: POST
 *    /v1/segment, x-api-key header, multipart field "image_file"
 *  - the result lands as `altRemovedSrc` with `activeCutout: "alt"`
 *  - tapping again switches between the two stored results with zero new
 *    requests to either engine — comparing costs nothing
 *  - switching the switch off and on again keeps showing the last-selected
 *    result, still with no new processing
 *  - an alt-first flow can produce the main result on switch-back
 *  - a failed call stays honest and a retry can succeed
 *  - flat artwork can also be compared through the row (an evaluation action
 *    the client asked for; the normal pipeline never uploads it)
 *
 * Not part of `npm run qa-site`: it must run against a server that was started
 * with NEXT_PUBLIC_CUTOUT_ALT=photoroom. On a normal server it fails the first
 * scenario and says exactly why.
 */
import { chromium } from "playwright";
import http from "node:http";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const BROWSER = process.env.QA_BROWSER ?? "chrome";
const MOCK_PORT = Number(process.env.QA_PHOTOROOM_PORT ?? 3971);
const API_KEY = "test-key-123";
const DRAFT_KEY = "kcp.draft.v3.crown-classic-tee";
/** The lab measured this one as "photograph" (see lib/imageFx.ts). */
const PHOTO = "public/cutout-samples/mug.jpg";
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const flatLogo = `x.fillStyle="#ffffff";x.fillRect(0,0,420,420);x.fillStyle="#c0392b";x.beginPath();x.arc(210,210,130,0,7);x.fill();`;

/* ---- The mock Photoroom service ---------------------------------------- */

function startMock(cutoutPng) {
  const state = { calls: [], keySeen: [], failNext: 0 };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (req.method !== "POST" || !(req.url ?? "").startsWith("/v1/segment")) {
        res.writeHead(404).end();
        return;
      }
      state.calls.push({
        contentType: req.headers["content-type"] ?? "",
        body: Buffer.concat(chunks),
      });
      state.keySeen.push(String(req.headers["x-api-key"] ?? ""));
      if (state.failNext > 0) {
        state.failNext -= 1;
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "the trial said no" }));
        return;
      }
      res.writeHead(200, { "content-type": "image/png" });
      res.end(cutoutPng);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(MOCK_PORT, "127.0.0.1", () => resolve({ server, state }));
  });
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
  const rowPosts = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/cutout-bridge")) {
      bridgePosts.push(request.url());
    }
    if (request.url().includes("/api/photoroom-cutout")) {
      rowPosts.push({ headers: request.headers(), body: request.postDataBuffer() });
    }
    if (isModelDownload(request.url())) {
      modelRequests.push(request.url());
    }
  });
  return { bridgePosts, modelRequests, rowPosts };
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

async function tapAltRow(page) {
  const row = page.locator(".rot-alt-cutout");
  await row.scrollIntoViewIfNeeded();
  await row.click();
}

async function altRowText(page) {
  return ((await page.locator(".rot-alt-cutout").textContent().catch(() => "")) ?? "").replace(/\s+/g, " ");
}

/** Waits until the toast text matches, so a stale toast cannot be read. */
async function waitForToastText(page, pattern, timeout = 15000) {
  await page
    .waitForFunction(
      (source) => new RegExp(source, "i").test(document.querySelector(".rot-toast")?.textContent ?? ""),
      pattern.source,
      { timeout },
    )
    .catch(() => {});
  const text = await page.locator(".rot-toast").first().textContent().catch(() => "");
  return (text ?? "").replace(/\s+/g, " ").trim();
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

async function settleActive(page, which) {
  await page
    .waitForFunction(
      ([key, target]) => {
        const design = JSON.parse(localStorage.getItem(key) ?? "null")?.design;
        const layer = design?.front?.[design.front.length - 1];
        return (layer?.activeCutout ?? "primary") === target;
      },
      [DRAFT_KEY, which],
      { timeout: 15000 },
    )
    .catch(() => {});
}

async function readLayer(page) {
  return await page.evaluate((key) => {
    const layer = JSON.parse(localStorage.getItem(key)).design.front.at(-1);
    return {
      src: layer.src ?? null,
      primary: layer.backgroundRemovedSrc ?? null,
      alt: layer.altRemovedSrc ?? null,
      activeCutout: layer.activeCutout ?? null,
      cutoutSource: layer.cutoutSource ?? null,
      removeBg: Boolean(layer.fx?.removeBg),
    };
  }, DRAFT_KEY);
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
    };
  }, DRAFT_KEY);
}

/* ---- preflight: the server must carry the alt engine ------------------- */

{
  const status = await fetch(`${BASE}/api/photoroom-cutout`, { method: "POST", body: new FormData() })
    .then((response) => response.status)
    .catch(() => 0);
  check(
    "the server has the comparison engine configured",
    status === 400,
    status === 0
      ? "no dev server answered — start it first"
      : status === 400
        ? "route answered 400 (ready)"
        : `route answered ${status} — start the dev server with PHOTOROOM_API_KEY and NEXT_PUBLIC_CUTOUT_ALT=photoroom`,
  );
}

const browser = await chromium.launch({ channel: BROWSER, headless: true });

/* The cut-out Photoroom will hand back: a solid subject, clear corners. */
const helper = await browser.newContext();
const helperPage = await helper.newPage();
const cutoutPng = await drawPng(
  helperPage,
  `x.fillStyle="#2b6cb0";x.beginPath();x.arc(210,210,150,0,7);x.fill();`,
);
const flatArtworkPng = await drawPng(helperPage, flatLogo);
await helper.close();

let mock;
try {
  mock = await startMock(cutoutPng);
} catch (error) {
  console.log(`FAIL could not listen on 127.0.0.1:${MOCK_PORT} — ${error?.code ?? error}`);
  await browser.close();
  process.exit(1);
}
const { state } = mock;

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

    /* -------- scenario A: both engines, compare freely ------------------ */

    {
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const { bridgePosts, modelRequests, rowPosts } = attachSpies(page);

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
            status: 200,
            contentType: "image/png",
            headers: { "access-control-allow-origin": "*" },
            body: cutoutPng,
          });
        },
      );

      await uploadPhoto(page, PHOTO);

      const rowOffered = await page.locator(".rot-alt-cutout").first().isVisible().catch(() => false);
      check(
        `${label} alt: the comparison row is offered`,
        rowOffered,
        rowOffered ? await altRowText(page) : "start the dev server with NEXT_PUBLIC_CUTOUT_ALT=photoroom and re-run",
      );
      if (!rowOffered) {
        await page.close();
        continue;
      }

      // The main result first: the imgix switch, unchanged by any of this.
      await flipRemoveBackground(page);
      const firstToast = await waitForToastText(page, /background removed/i, 60000);
      await settleDraft(page);
      const primary = await readLayer(page);
      check(
        `${label} alt: the main switch still cuts with the hosted engine`,
        /^background removed\.$/i.test(firstToast) && primary.cutoutSource === "hosted" && primary.activeCutout === "primary",
        `${firstToast || "no toast"}, source ${primary.cutoutSource}`,
      );

      const callsBefore = state.calls.length;
      const started = Date.now();
      await tapAltRow(page);
      const altToast = await waitForToastText(page, /background removed/i, 60000);
      const elapsed = Date.now() - started;
      await settleActive(page, "alt");
      const altLayer = await readLayer(page);
      const altProbe = await probeLayer(page);
      const upstream = state.calls[state.calls.length - 1];
      const upstreamType = upstream
        ? upstream.body.subarray(0, 4096).toString("latin1").match(/content-type: (image\/[a-z0-9.+-]+)/i)?.[1] ?? "unknown"
        : "none";

      check(
        `${label} alt: the tap posts through our own route, not from the browser straight to the service`,
        rowPosts.length === 1 && state.calls.length === callsBefore + 1,
        `${rowPosts.length} client post(s), ${state.calls.length - callsBefore} upstream call(s)`,
      );
      check(
        `${label} alt: the API key stays on the server`,
        rowPosts.every((entry) => !Object.keys(entry.headers).some((name) => name.toLowerCase() === "x-api-key")) &&
          rowPosts.every((entry) => (entry.body ? !entry.body.includes(API_KEY) : true)),
        JSON.stringify(rowPosts[0]?.headers ?? {}),
      );
      check(
        `${label} alt: the client sends the photo under the documented field`,
        Boolean(rowPosts[0]?.body?.includes('name="image"')),
        rowPosts[0]?.body ? `body ${rowPosts[0].body.length} bytes` : "no client body seen",
      );
      check(
        `${label} alt: the service receives exactly the documented contract`,
        Boolean(upstream) &&
          upstream.contentType.startsWith("multipart/form-data") &&
          upstream.body.includes('name="image_file"') &&
          upstream.body.includes(Buffer.from([0xff, 0xd8, 0xff])),
        `${upstream?.contentType ?? "no call"}, ${upstreamType}`,
      );
      check(
        `${label} alt: the prepared upload is JPEG — never the editor's WebP copy`,
        upstreamType === "image/jpeg",
        upstreamType,
      );
      check(
        `${label} alt: the server sent the configured key`,
        state.keySeen.length > 0 && state.keySeen.every((key) => key === API_KEY),
        state.keySeen.join(",") || "none",
      );
      check(
        `${label} alt: the result lands as the stored alt cut-out and is shown`,
        Boolean(altLayer.alt) &&
          altLayer.activeCutout === "alt" &&
          altLayer.removeBg &&
          altLayer.cutoutSource === "hosted",
        `alt ${altLayer.alt ? "stored" : "missing"}, active ${altLayer.activeCutout}, source ${altLayer.cutoutSource}`,
      );
      check(
        `${label} alt: the backdrop is fully cleared and the subject survives`,
        altProbe.corner === 0 && altProbe.center > 128,
        `corner alpha ${altProbe.corner}, center alpha ${altProbe.center}`,
      );
      check(
        `${label} alt: the row says which result is showing`,
        /Showing Photoroom's result/i.test(await altRowText(page)),
        await altRowText(page),
      );
      check(
        `${label} alt: the customer is told the background is removed`,
        /^background removed\.$/i.test(altToast),
        altToast || "no toast",
      );
      check(
        `${label} alt: the photo is cut out promptly`,
        elapsed < 20000,
        `${elapsed}ms`,
      );

      // Switching back costs nothing — both results are already stored.
      await tapAltRow(page);
      await settleActive(page, "primary");
      const backLayer = await readLayer(page);
      check(
        `${label} alt: switching back is instant and free`,
        backLayer.activeCutout === "primary" &&
          backLayer.src === primary.src &&
          state.calls.length === callsBefore + 1 &&
          imgixRequests.length === 1 &&
          bridgePosts.length === 1,
        `${state.calls.length - callsBefore} upstream call(s), ${imgixRequests.length} imgix request(s), ${bridgePosts.length} bridge upload(s)`,
      );
      check(
        `${label} alt: the row flips back to offering the other result`,
        /Show Photoroom's result/i.test(await altRowText(page)),
        await altRowText(page),
      );

      await tapAltRow(page);
      await settleActive(page, "alt");
      const againLayer = await readLayer(page);
      check(
        `${label} alt: switching forward again is also free`,
        againLayer.src === altLayer.src && state.calls.length === callsBefore + 1,
        `${state.calls.length - callsBefore} upstream call(s)`,
      );

      // The switch keeps showing whatever result was last selected.
      await flipRemoveBackground(page); // off
      const offToast = await waitForToastText(page, /original background restored/i);
      await flipRemoveBackground(page); // on
      const onToast = await waitForToastText(page, /background removed/i, 60000);
      await settleActive(page, "alt");
      const finalLayer = await readLayer(page);
      check(
        `${label} alt: off and on again shows the last-selected result, with nothing re-processed`,
        /original background restored/i.test(offToast) &&
          /^background removed\.$/i.test(onToast) &&
          finalLayer.activeCutout === "alt" &&
          finalLayer.src === altLayer.src &&
          state.calls.length === callsBefore + 1 &&
          imgixRequests.length === 1 &&
          bridgePosts.length === 1,
        `${state.calls.length - callsBefore} upstream call(s), ${imgixRequests.length} imgix request(s), ${bridgePosts.length} bridge upload(s)`,
      );
      check(
        `${label} alt: no model is downloaded when the hosted engines do the work`,
        modelRequests.length === 0,
        modelRequests[0] ?? "none requested",
      );
      check(`${label} alt: no browser errors`, errors.length === 0, errors.join(" | "));

      await page.close();
    }

    /* -------- scenario B: the row first, the main result later (mobile) - */

    if (mobile) {
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const { bridgePosts, rowPosts } = attachSpies(page);

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
            status: 200,
            contentType: "image/png",
            headers: { "access-control-allow-origin": "*" },
            body: cutoutPng,
          });
        },
      );

      await uploadPhoto(page, PHOTO);
      const callsBefore = state.calls.length;

      // No switch first: the comparison row runs straight away.
      await tapAltRow(page);
      const altToast = await waitForToastText(page, /background removed/i, 60000);
      await settleActive(page, "alt");
      const altLayer = await readLayer(page);

      check(
        `${label} alt-first: the row works without the main switch ever running`,
        /^background removed\.$/i.test(altToast) &&
          Boolean(altLayer.alt) &&
          altLayer.activeCutout === "alt" &&
          altLayer.removeBg,
        `${altToast || "no toast"}, active ${altLayer.activeCutout}`,
      );
      check(
        `${label} alt-first: the photo was never parked on the bridge`,
        bridgePosts.length === 0 && imgixRequests.length === 0,
        `${bridgePosts.length} bridge upload(s), ${imgixRequests.length} imgix request(s)`,
      );
      check(
        `${label} alt-first: one service call only`,
        state.calls.length === callsBefore + 1 && rowPosts.length === 1,
        `${state.calls.length - callsBefore} upstream call(s)`,
      );

      // Switching back at this point produces the main result for the first time.
      await tapAltRow(page);
      await settleActive(page, "primary");
      const backToast = await waitForToastText(page, /background removed/i, 60000);
      const backLayer = await readLayer(page);
      check(
        `${label} alt-first: switching back produces the main result on the spot`,
        /^background removed\.$/i.test(backToast) &&
          Boolean(backLayer.primary) &&
          backLayer.activeCutout === "primary" &&
          backLayer.cutoutSource === "hosted" &&
          bridgePosts.length === 1 &&
          imgixRequests.length === 1,
        `${bridgePosts.length} bridge upload(s), ${imgixRequests.length} imgix request(s)`,
      );
      check(
        `${label} alt-first: the service was not called a second time`,
        state.calls.length === callsBefore + 1,
        `${state.calls.length - callsBefore} upstream call(s)`,
      );
      check(`${label} alt-first: no browser errors`, errors.length === 0, errors.join(" | "));

      await page.close();
    }

    /* -------- scenario C: a failed call stays honest, a retry can work -- */

    if (!mobile) {
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));

      await page.goto(`${BASE}/customize/crown-classic-tee?color=black&sizes=M%3A1`, {
        waitUntil: "commit",
        timeout: 30000,
      });
      await page.locator(".rot-canvas-svg").waitFor();

      await page.route(
        (url) => url.hostname.endsWith(".imgix.net"),
        async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "image/png",
            headers: { "access-control-allow-origin": "*" },
            body: cutoutPng,
          });
        },
      );

      await uploadPhoto(page, PHOTO);
      await flipRemoveBackground(page);
      await waitForToastText(page, /background removed/i, 60000);
      await settleDraft(page);
      const primary = await readLayer(page);

      const callsBefore = state.calls.length;
      state.failNext = 1;
      await tapAltRow(page);
      const failToast = await waitForToastText(page, /simpler cut-out|could not load/i, 60000);
      const midLayer = await readLayer(page);

      check(
        `${label} failure: the setback is reported honestly and the current result stays`,
        /simpler cut-out/i.test(failToast) &&
          midLayer.alt === null &&
          midLayer.src === primary.src &&
          midLayer.activeCutout === "primary",
        `${failToast || "no toast"}, active ${midLayer.activeCutout}`,
      );
      check(
        `${label} failure: the row still offers a retry`,
        /Remove Background with Photoroom/i.test(await altRowText(page)),
        await altRowText(page),
      );

      await tapAltRow(page);
      const retryToast = await waitForToastText(page, /background removed/i, 60000);
      await settleActive(page, "alt");
      const retryLayer = await readLayer(page);

      check(
        `${label} failure: the retry succeeds and the result lands`,
        /^background removed\.$/i.test(retryToast) &&
          Boolean(retryLayer.alt) &&
          retryLayer.activeCutout === "alt" &&
          state.calls.length === callsBefore + 2,
        `${retryToast || "no toast"}, ${state.calls.length - callsBefore} call(s)`,
      );
      check(`${label} failure: no browser errors`, errors.length === 0, errors.join(" | "));

      await page.close();
    }

    /* -------- scenario D: flat artwork can be compared too (desktop) ---- */

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

      await page.locator('input[type="file"]').setInputFiles({
        name: "flat-logo.png",
        mimeType: "image/png",
        buffer: flatArtworkPng,
      });
      await page.locator(".rot-editor").waitFor({ state: "visible" });
      await page.waitForTimeout(300);

      const callsBefore = state.calls.length;
      await tapAltRow(page);
      const toast = await waitForToastText(page, /background removed/i, 60000);
      await settleActive(page, "alt");
      const layer = await readLayer(page);
      const probe = await probeLayer(page);

      check(
        `${label} flat: the row can be tried on flat artwork (an evaluation action — the normal pipeline never uploads it)`,
        /^background removed\.$/i.test(toast) &&
          Boolean(layer.alt) &&
          layer.activeCutout === "alt" &&
          layer.cutoutSource === "hosted" &&
          state.calls.length === callsBefore + 1,
        `${toast || "no toast"}, ${state.calls.length - callsBefore} call(s)`,
      );
      check(
        `${label} flat: still no bridge upload and no imgix request on this path`,
        bridgePosts.length === 0 && imgixRequests.length === 0,
        `${bridgePosts.length} bridge upload(s), ${imgixRequests.length} imgix request(s)`,
      );
      check(
        `${label} flat: the result is a clean cut-out`,
        probe.corner === 0 && probe.center > 128,
        `corner alpha ${probe.corner}, center alpha ${probe.center}`,
      );
      check(`${label} flat: no browser errors`, errors.length === 0, errors.join(" | "));

      await page.close();
    }

    await context.close();
  }
} finally {
  await browser.close();
  mock.server.close();
}

if (state.calls.length === 0) {
  console.log(
    `\nThe mock service was never called. Start the dev server with PHOTOROOM_API_KEY and PHOTOROOM_API_URL=http://127.0.0.1:${MOCK_PORT} too.`,
  );
}

if (failures > 0) {
  console.log(`${failures} Photoroom comparison check(s) failed`);
  process.exit(1);
}
console.log("ALL PHOTOROOM COMPARISON CHECKS PASSED");
