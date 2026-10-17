/**
 * Checks for the hosted cut-out comparison page (/cutout-compare).
 *
 *  - lib/imgixCutout.ts pins the exact parameters rushordertees sends to imgix
 *  - the photo bridge round-trips a photo (POST /api/cutout-bridge -> GET it back)
 *  - the page renders its three panes, picks samples, accepts an upload and
 *    keeps its footing on a phone (no horizontal overflow)
 *
 * The imgix network itself is not exercised here — rendering `bg-remove` needs
 * a dashboard source that only the account owner can configure.
 *
 * Needs the dev server on http://localhost:3000 (like the other page tests).
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const BROWSER = process.env.QA_BROWSER ?? "chrome";
const PHOTO = "public/cutout-samples/mug.jpg";
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

/* ---- 1. The URL builder pins the rushordertees recipe -------------------- */

{
  const output = ts.transpileModule(readFileSync("lib/imgixCutout.ts", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, URL });
  const { imgixCutoutUrl, cleanImgixDomain } = exports;

  const built = imgixCutoutUrl("kingdom-cutout.imgix.net", "/cutout-samples/mug.jpg");
  check(
    "the default request mirrors rushordertees exactly",
    built ===
      "https://kingdom-cutout.imgix.net/cutout-samples/mug.jpg?bg-remove=true&trim=colorUnlessAlpha&fm=png&cs=strip",
    built,
  );
  check(
    "picking a model appends bg-remove-model",
    imgixCutoutUrl("x.imgix.net", "a.jpg", "3") ===
      "https://x.imgix.net/a.jpg?bg-remove=true&trim=colorUnlessAlpha&fm=png&cs=strip&bg-remove-model=3",
  );
  check(
    "a pasted dashboard URL is accepted",
    cleanImgixDomain("https://x.imgix.net/") === "x.imgix.net",
  );
  check(
    "an empty domain is refused",
    (() => {
      try {
        imgixCutoutUrl("  ", "a.jpg");
        return false;
      } catch {
        return true;
      }
    })(),
  );
}

/* ---- 2. The photo bridge ------------------------------------------------- */

{
  const photo = readFileSync(PHOTO);
  const form = new FormData();
  form.append("image", new Blob([photo], { type: "image/jpeg" }), "mug.jpg");
  const upload = await fetch(`${BASE}/api/cutout-bridge`, { method: "POST", body: form });
  const payload = await upload.json().catch(() => null);
  check("the bridge accepts a photo", upload.ok && typeof payload?.path === "string", JSON.stringify(payload));

  if (upload.ok && payload?.path) {
    const served = await fetch(`${BASE}${payload.path}`);
    const bytes = Buffer.from(await served.arrayBuffer());
    check(
      "the bridge serves the same bytes back",
      served.ok &&
        bytes.equals(photo) &&
        served.headers.get("content-type") === "image/jpeg",
      `${served.status} ${served.headers.get("content-type")} ${bytes.length}B`,
    );
    const unknown = await fetch(`${BASE}${payload.path.replace(/[a-f0-9]{32}$/, "0".repeat(32))}`);
    check("an unknown photo id is a 404", unknown.status === 404, String(unknown.status));
  }

  const wrong = new FormData();
  wrong.append("image", new Blob([Buffer.from("not an image")], { type: "text/plain" }), "x.txt");
  const rejected = await fetch(`${BASE}/api/cutout-bridge`, { method: "POST", body: wrong });
  check("a non-photo is refused", rejected.status === 415, String(rejected.status));
}

/* ---- 3. The page --------------------------------------------------------- */

const browser = await chromium.launch({ channel: BROWSER, headless: true });

try {
  for (const [label, viewport] of [
    ["desktop", { width: 1280, height: 900 }],
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
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${BASE}/cutout-compare`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").waitFor();

    check(`${label}: the three panes render`, (await page.locator(".cc-pane").count()) === 3);
    check(
      `${label}: five sample photos plus the upload button`,
      (await page.locator(".cc-sample").count()) === 6,
      String(await page.locator(".cc-sample").count()),
    );
    check(
      `${label}: without a domain the imgix pane explains itself`,
      /paste the imgix domain/i.test(await page.locator(".cc-pane").nth(1).innerText()),
    );

    await page.getByRole("button", { name: /Flowers/ }).click();
    check(
      `${label}: picking a sample updates the test line`,
      /Testing Flowers/.test(await page.locator(".cc-current").innerText()),
    );

    await page.locator(".cc-field input").fill("demo.imgix.net");
    const imgSrc = await page.locator(".cc-pane").nth(1).locator("img").getAttribute("src");
    check(
      `${label}: the middle pane requests imgix with the pinned parameters`,
      Boolean(
        imgSrc &&
          imgSrc.startsWith("https://demo.imgix.net/cutout-samples/portrait-flowers.jpg?") &&
          imgSrc.includes("bg-remove=true") &&
          imgSrc.includes("trim=colorUnlessAlpha") &&
          imgSrc.includes("fm=png") &&
          imgSrc.includes("cs=strip"),
      ),
      imgSrc ?? "",
    );

    await page.locator('input[type="file"]').setInputFiles(PHOTO);
    await page.waitForFunction(
      () => document.querySelector(".cc-current")?.textContent?.includes("mug.jpg"),
      undefined,
      { timeout: 30000 },
    );
    const uploadSrc = await page.locator(".cc-pane").nth(1).locator("img").getAttribute("src");
    check(
      `${label}: an uploaded photo is fetched back through the bridge`,
      Boolean(
        uploadSrc &&
          uploadSrc.startsWith("https://demo.imgix.net/api/cutout-bridge/") &&
          uploadSrc.includes("bg-remove=true"),
      ),
      uploadSrc ?? "",
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    check(`${label}: no horizontal overflow`, overflow <= 1, `${overflow}px`);
    check(`${label}: no page errors`, errors.length === 0, errors.join("; "));

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
