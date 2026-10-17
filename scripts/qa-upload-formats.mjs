/**
 * Upload format checks — the files phones and the web actually hand over:
 * iPhone HEIC (also renamed to .jpg, which is how chat apps and Windows
 * deliver it), AVIF, oversized files, broken files and old formats — driven
 * through the real upload input on the customizer.
 *
 * Needs a dev server (npm run dev). No imgix source needed: this is the
 * on-device upload path.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const DRAFT_KEY = "kcp.draft.v3.crown-classic-tee";
const SAMPLE = "public/cutout-samples";

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const heicBytes = readFileSync(`${SAMPLE}/example.heic`);
const jpgBytes = readFileSync(`${SAMPLE}/mug.jpg`);
const pngBytes = readFileSync("public/img/catalog-models/tee.png");
const avifBytes = readFileSync(`${SAMPLE}/sample.avif`);
const hugeBytes = Buffer.alloc(9 * 1024 * 1024, 0x20);

/** [label, file payload, expected] — "layer" or a substring of the error toast. */
const DESKTOP_CASES = [
  ["jpg", { name: "photo.jpg", mimeType: "image/jpeg", buffer: jpgBytes }, "layer"],
  ["png", { name: "logo.png", mimeType: "image/png", buffer: pngBytes }, "layer"],
  // Windows/Android often report .heic as not-an-image; the bytes decide.
  ["heic", { name: "IMG_0402.HEIC", mimeType: "application/octet-stream", buffer: heicBytes }, "layer"],
  // Renamed by a chat app or a file manager — the classic "some work, some don't".
  ["heic renamed .jpg", { name: "IMG_0402.jpg", mimeType: "image/jpeg", buffer: heicBytes }, "layer"],
  ["avif", { name: "google-image.avif", mimeType: "image/avif", buffer: avifBytes }, "layer"],
  ["oversized", { name: "huge.jpg", mimeType: "image/jpeg", buffer: hugeBytes }, "8 MB"],
  ["broken png", { name: "broken.png", mimeType: "image/png", buffer: Buffer.from("this is not really an image") }, "decoded"],
  ["unsupported bmp", { name: "old.bmp", mimeType: "image/bmp", buffer: Buffer.from("BMfake") }, "BMP"],
];

async function runCase(page, payload) {
  await page.goto(BASE, { waitUntil: "commit" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/customize/crown-classic-tee?color=black&sizes=M%3A1`, { waitUntil: "commit" });
  await page.locator(".rot-canvas-svg").waitFor();

  await page.locator('input[type="file"]').setInputFiles(payload);
  await page
    .waitForFunction(
      (key) => {
        const raw = localStorage.getItem(key);
        const added = raw ? JSON.parse(raw).design.front.length > 0 : false;
        return added || document.querySelector(".rot-toast") !== null;
      },
      DRAFT_KEY,
      { timeout: 25000 },
    )
    .catch(() => {});
  await page.waitForTimeout(300);

  const layer = await page
    .evaluate(async (key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const last = JSON.parse(raw).design.front.at(-1);
      if (!last?.src) return null;
      const image = new Image();
      image.src = last.src;
      const ok = await image
        .decode()
        .then(() => true)
        .catch(() => false);
      return { ok, width: image.naturalWidth, height: image.naturalHeight, type: last.type };
    }, DRAFT_KEY)
    .catch(() => null);
  const toast = await page
    .locator(".rot-toast")
    .first()
    .textContent()
    .catch(() => null);
  return { layer, toast: toast ? toast.replace(/\s+/g, " ").trim() : null };
}

const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  page.setDefaultTimeout(30000);

  for (const [label, payload, expected] of DESKTOP_CASES) {
    const { layer, toast } = await runCase(page, payload);
    if (expected === "layer") {
      const detail = layer ? `${layer.type} ${layer.width}x${layer.height}` : `toast: ${toast ?? "none"}`;
      check(`desktop ${label}: uploads and lands on the design`, Boolean(layer?.ok), detail);
      if (label.startsWith("heic")) {
        check(
          `desktop ${label}: the converted photo has real pixels`,
          (layer?.width ?? 0) > 300 && (layer?.height ?? 0) > 300,
          `${layer?.width ?? 0}x${layer?.height ?? 0}`,
        );
      }
    } else {
      check(
        `desktop ${label}: refused with a helpful message`,
        !layer && Boolean(toast?.includes(expected)),
        toast ?? "no toast",
      );
    }
  }
  await desktop.close();

  const iphone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const phonePage = await iphone.newPage();
  phonePage.setDefaultTimeout(30000);
  const { layer, toast } = await runCase(phonePage, {
    name: "IMG_0402.HEIC",
    mimeType: "application/octet-stream",
    buffer: heicBytes,
  });
  check(
    "phone heic: uploads and lands on the design",
    Boolean(layer?.ok),
    layer ? `${layer.type} ${layer.width}x${layer.height}` : `toast: ${toast ?? "none"}`,
  );
  await iphone.close();
} finally {
  await browser.close();
}

if (failures > 0) {
  console.log(`${failures} upload format check(s) failed`);
  process.exit(1);
}
console.log("ALL UPLOAD FORMAT CHECKS PASSED");
