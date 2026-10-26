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

  /* The reference interaction: draw one box around several layers, then move
     the temporary selection as a rigid unit. */
  await page.locator('button.rot-tool[data-tool="text"]').click();
  await page.getByRole("textbox", { name: "New text", exact: true }).fill("Pair test");
  await page.getByRole("button", { name: "+ Add text", exact: true }).click();
  const pairArtwork = page.locator(".rot-canvas-svg text").filter({ hasText: "PAIR TEST" }).first();
  await pairArtwork.waitFor({ state: "visible" });
  await select.click();

  const dragMarquee = async (input = "mouse") => {
    const boxes = await Promise.all([artwork.boundingBox(), pairArtwork.boundingBox()]);
    const svgBox = await page.locator(".rot-canvas-svg").boundingBox();
    if (!boxes[0] || !boxes[1] || !svgBox) return false;
    const left = Math.max(svgBox.x + 6, Math.min(boxes[0].x, boxes[1].x) - 26);
    const top = Math.max(svgBox.y + 6, Math.min(boxes[0].y, boxes[1].y) - 26);
    const right = Math.min(svgBox.x + svgBox.width - 6, Math.max(boxes[0].x + boxes[0].width, boxes[1].x + boxes[1].width) + 26);
    const bottom = Math.min(svgBox.y + svgBox.height - 6, Math.max(boxes[0].y + boxes[0].height, boxes[1].y + boxes[1].height) + 26);

    if (input === "touch") {
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
      const point = (x, y) => ({ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 });
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(left, top)] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point((left + right) / 2, (top + bottom) / 2)] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(right, bottom)] });
      const visible = await page.locator("[data-selection-marquee]").isVisible().catch(() => false);
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await session.detach();
      return visible;
    }

    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move((left + right) / 2, (top + bottom) / 2, { steps: 3 });
    const visible = await page.locator("[data-selection-marquee]").isVisible().catch(() => false);
    await page.mouse.move(right, bottom, { steps: 4 });
    await page.mouse.up();
    return visible;
  };

  check("Select drag shows a marquee", await dragMarquee());
  check(
    "Mouse marquee selects both design layers",
    await page.locator(".rot-selcount").textContent() === "2 selected"
      && await page.locator("[data-group-frame]").count() === 1,
  );

  const beforePairMove = await Promise.all([artwork.boundingBox(), pairArtwork.boundingBox()]);
  const firstSelectedBox = await artwork.boundingBox();
  if (firstSelectedBox) {
    const x = firstSelectedBox.x + firstSelectedBox.width / 2;
    const y = firstSelectedBox.y + firstSelectedBox.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 42, y + 24, { steps: 8 });
    await page.mouse.up();
  }
  const afterPairMove = await Promise.all([artwork.boundingBox(), pairArtwork.boundingBox()]);
  const pairDeltas = beforePairMove.map((before, index) => ({
    x: before && afterPairMove[index] ? afterPairMove[index].x - before.x : 0,
    y: before && afterPairMove[index] ? afterPairMove[index].y - before.y : 0,
  }));
  check(
    "Marquee selection moves as one rigid design",
    pairDeltas.every((delta) => delta.x > 20 && delta.y > 10)
      && Math.abs(pairDeltas[0].x - pairDeltas[1].x) < 2
      && Math.abs(pairDeltas[0].y - pairDeltas[1].y) < 2,
    JSON.stringify(pairDeltas),
  );

  await page.getByRole("button", { name: "Clear selection" }).click();

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

  await page.setViewportSize({ width: 390, height: 844 });
  check("One-finger drag shows a mobile selection marquee", await dragMarquee("touch"));
  check(
    "One-finger marquee selects both design layers on mobile",
    await page.locator(".rot-selcount").textContent() === "2 selected"
      && await page.locator("[data-group-frame]").count() === 1,
  );
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
