/** Browser regression for the Select and Hand canvas interaction tools. */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const BROWSER = process.env.QA_BROWSER ?? "chrome";
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch({ channel: BROWSER, headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(`${BASE}/customize/crown-classic-tee?qa=canvas-tools`, {
    waitUntil: "commit",
    timeout: 30000,
  });
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 60000 });

  const select = page.getByRole("button", { name: "Mouse select tool" });
  const hand = page.getByRole("button", { name: "Hand pan tool" });
  check("Select and Hand tools are visible on desktop", await select.isVisible() && await hand.isVisible());
  check("Select is the safe default", await select.getAttribute("aria-pressed") === "true");

  await page.locator('button.rot-tool[data-tool="text"]').click();
  await page.getByRole("textbox", { name: "New text", exact: true }).fill("Pan test");
  await page.getByRole("button", { name: "+ Add text", exact: true }).click();
  const artwork = page.locator(".rot-canvas-svg text").filter({ hasText: "PAN TEST" }).first();
  await artwork.waitFor({ state: "visible" });

  await hand.click();
  check(
    "Hand mode closes the editor and protects artwork handles",
    await hand.getAttribute("aria-pressed") === "true"
      && await page.locator(".rot").getAttribute("data-layout") === "none"
      && await page.locator('.rot-canvas-svg rect[stroke="#2f7bff"]').count() === 0,
  );

  const stage = page.locator(".rot-stage");
  const garment = page.locator(".rot-shirt");
  const beforeGarment = await garment.boundingBox();
  const beforeArtwork = await artwork.boundingBox();
  const stageBox = await stage.boundingBox();
  if (stageBox) {
    const x = stageBox.x + stageBox.width / 2;
    const y = stageBox.y + stageBox.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 48, y + 34, { steps: 8 });
    await page.mouse.up();
  }
  const afterGarment = await garment.boundingBox();
  const afterArtwork = await artwork.boundingBox();
  const garmentDx = beforeGarment && afterGarment ? afterGarment.x - beforeGarment.x : 0;
  const garmentDy = beforeGarment && afterGarment ? afterGarment.y - beforeGarment.y : 0;
  const artworkDx = beforeArtwork && afterArtwork ? afterArtwork.x - beforeArtwork.x : 0;
  const artworkDy = beforeArtwork && afterArtwork ? afterArtwork.y - beforeArtwork.y : 0;
  check(
    "Hand drag pans the garment and artwork together",
    Math.abs(garmentDx) > 20
      && Math.abs(garmentDy) > 15
      && Math.abs(garmentDx - artworkDx) < 2
      && Math.abs(garmentDy - artworkDy) < 2,
    `garment ${Math.round(garmentDx)},${Math.round(garmentDy)}; artwork ${Math.round(artworkDx)},${Math.round(artworkDy)}`,
  );

  await select.click();
  check("Select mode restores artwork hit targets", await select.getAttribute("aria-pressed") === "true");
  const selectedArtwork = await artwork.boundingBox();
  const garmentBeforeEdit = await garment.boundingBox();
  if (selectedArtwork) {
    const x = selectedArtwork.x + selectedArtwork.width / 2;
    const y = selectedArtwork.y + selectedArtwork.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 28, y, { steps: 8 });
    await page.mouse.up();
  }
  const artworkAfterEdit = await artwork.boundingBox();
  const garmentAfterEdit = await garment.boundingBox();
  check(
    "Select drag moves artwork without moving the garment",
    Boolean(selectedArtwork && artworkAfterEdit && garmentBeforeEdit && garmentAfterEdit)
      && artworkAfterEdit.x - selectedArtwork.x > 10
      && Math.abs(garmentAfterEdit.x - garmentBeforeEdit.x) < 1
      && Math.abs(garmentAfterEdit.y - garmentBeforeEdit.y) < 1,
  );

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSelect = await select.boundingBox();
  const mobileHand = await hand.boundingBox();
  check(
    "Mobile Select and Hand targets are at least 44px",
    Boolean(mobileSelect && mobileHand)
      && mobileSelect.width >= 44 && mobileSelect.height >= 44
      && mobileHand.width >= 44 && mobileHand.height >= 44,
    mobileSelect && mobileHand
      ? `${Math.round(mobileSelect.width)}x${Math.round(mobileSelect.height)}, ${Math.round(mobileHand.width)}x${Math.round(mobileHand.height)}`
      : "missing controls",
  );

  for (const viewport of [
    { width: 320, height: 568, label: "small phone" },
    { width: 390, height: 844, label: "phone" },
    { width: 430, height: 932, label: "large phone" },
    { width: 768, height: 1024, label: "tablet portrait" },
    { width: 844, height: 390, label: "phone landscape" },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForTimeout(80);
    const [toolbarBox, currentStageBox, currentSelect, currentHand, overflow] = await Promise.all([
      page.locator(".rot-canvas-mode").boundingBox(),
      stage.boundingBox(),
      select.boundingBox(),
      hand.boundingBox(),
      page.locator("body").evaluate((body) => body.scrollWidth - window.innerWidth),
    ]);
    const toolbarInsideStage = Boolean(toolbarBox && currentStageBox)
      && toolbarBox.x >= currentStageBox.x
      && toolbarBox.y >= currentStageBox.y
      && toolbarBox.x + toolbarBox.width <= currentStageBox.x + currentStageBox.width + 1
      && toolbarBox.y + toolbarBox.height <= currentStageBox.y + currentStageBox.height + 1;
    const targetsUsable = Boolean(currentSelect && currentHand)
      && currentSelect.width >= 44 && currentSelect.height >= 44
      && currentHand.width >= 44 && currentHand.height >= 44;
    check(
      `${viewport.label} keeps canvas tools responsive`,
      overflow <= 1 && toolbarInsideStage && targetsUsable,
      `${viewport.width}x${viewport.height}; overflow ${Math.round(overflow)}px`,
    );
  }
  check("canvas tools run without page errors", errors.length === 0, errors.join(" | "));
} catch (error) {
  check("canvas tool flow", false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

if (failures) {
  console.error(`${failures} canvas tool check(s) failed`);
  process.exit(1);
}
