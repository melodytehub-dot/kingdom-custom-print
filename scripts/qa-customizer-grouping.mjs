/**
 * Grouping end-to-end: pick several elements, group them, move the group as one
 * object, lock it, step inside it, duplicate it and ungroup it again.
 * Runs on desktop and on a portrait phone (where the editor is a bottom sheet).
 */
import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const BROWSER = process.env.QA_BROWSER ?? "chrome";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
let failures = 0;

const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

/** The sandbox's Neon pool occasionally drops a connection; that is not our bug. */
const isEnvironmentNoise = (text) =>
  /CONNECT_TIMEOUT|pooler\.c-\d+\.us-east-1\.aws\.neon\.tech|Failed to fetch/i.test(text);

const browser = await chromium.launch({ channel: BROWSER, headless: true });

async function run(label, viewport, mobile) {
  const context = await browser.newContext({
    viewport,
    userAgent: mobile ? IPHONE_UA : undefined,
    hasTouch: mobile,
    isMobile: mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !isEnvironmentNoise(message.text()) && !message.text().includes("favicon")) {
      errors.push(message.text());
    }
  });

  const tool = (id) => page.locator(`button.rot-tool[data-tool="${id}"]`).first();
  const rows = page.locator(".rot-layerrow");
  const selbar = page.locator(".rot-selbar");
  const frames = page.locator(".rot-canvas-svg [data-group-frame]");
  const outlines = page.locator('.rot-canvas-svg rect[stroke-opacity="0.4"]');
  const editor = page.locator(".rot-panel").getByRole("textbox", { name: "Your text" });

  const openLayers = async () => {
    await tool("layers").evaluate((button) => button.click());
    await page.locator(".rot-layerlist").waitFor({ state: "visible", timeout: 5000 });
  };
  /** On phones the panel is a bottom sheet over the canvas; dismiss it. */
  const closeSheet = async () => {
    const dismiss = page.locator(".rot-panel-dismiss").first();
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
    await page.waitForTimeout(180);
  };
  const clearSelection = async () => {
    await closeSheet();
    const clear = selbar.getByLabel("Clear selection").first();
    if (await clear.isVisible().catch(() => false)) await clear.click();
    await page.waitForTimeout(180);
  };
  const addText = async (text) => {
    await tool("text").evaluate((button) => button.click());
    await page.locator(".rot-panel .rot-textarea").fill(text);
    await page.locator(".rot-panel .rot-cta").first().evaluate((button) => button.click());
    await page.waitForTimeout(200);
  };
  const tapLayer = async (text) => {
    const node = page.locator(".rot-canvas-svg text").filter({ hasText: text }).first();
    const box = await node.boundingBox();
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(280);
  };
  /** Ticks exactly the given row indexes, leaving rows that are already ticked alone. */
  const pickRows = async (indexes) => {
    const total = await rows.count();
    for (let i = 0; i < total; i += 1) {
      const row = rows.nth(i);
      const on = await row.evaluate((el) => el.classList.contains("is-on"));
      if (on !== indexes.includes(i)) await row.locator(".rot-layercheck").click();
    }
    await page.waitForTimeout(140);
  };
  const outlineBoxes = () =>
    outlines.evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect();
        return [Math.round(rect.x), Math.round(rect.y)];
      })
    );

  await page.goto(`${BASE}/customize/v-neck-tee?qa=grouping`, { waitUntil: "commit", timeout: 30000 });
  await page.locator("image.rot-shirt-photo").first().waitFor({ state: "attached", timeout: 60000 });

  await addText("ALPHA");
  await addText("BETA");

  /* ---- the Layers panel is how a customer finds and groups elements ---- */
  await openLayers();
  check(`${label}: the Layers panel lists every element`, (await rows.count()) === 2, `${await rows.count()} rows`);
  check(`${label}: the newest element sits on top`, (await rows.first().innerText()).includes("BETA"), await rows.first().innerText());

  await rows.nth(0).locator(".rot-layercheck").click();
  check(`${label}: Group waits for a second pick`, await page.locator(".rot-layer-group").isDisabled());
  await pickRows([0, 1]);
  check(`${label}: Group lights up once two elements are picked`, await page.locator(".rot-layer-group").isEnabled());
  await page.locator(".rot-layer-group").click();
  await page.waitForTimeout(250);

  const grouped = await rows.allInnerTexts();
  check(`${label}: every row reports the same group`, grouped.every((text) => /Group 1/.test(text)), grouped.join(" | "));

  /* ---- the group is one object: one frame, one rigid move ---- */
  await clearSelection();
  check(`${label}: clearing the selection hides the action bar`, (await selbar.count()) === 0);
  await tapLayer("ALPHA");
  check(`${label}: one tap picks up the whole group`, (await frames.count()) === 1, `${await frames.count()} frames`);
  check(`${label}: each member is outlined inside the frame`, (await outlines.count()) === 2, `${await outlines.count()} outlines`);
  check(`${label}: picking a group does not open the editor`, !(await editor.isVisible().catch(() => false)));
  check(`${label}: the action bar offers group actions`, await selbar.getByLabel("Ungroup").isVisible());

  const before = await outlineBoxes();
  const first = await outlines.first().boundingBox();
  if (first) {
    const from = { x: first.x + first.width / 2, y: first.y + first.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 6, from.y + 6);
    await page.mouse.move(from.x + 60, from.y + 40, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(220);
  }
  const after = await outlineBoxes();
  const dx = after.map((point, i) => point[0] - before[i][0]);
  const dy = after.map((point, i) => point[1] - before[i][1]);
  check(
    `${label}: dragging one member moves the whole group rigidly`,
    Math.abs(dx[0] - dx[1]) <= 1 && Math.abs(dy[0] - dy[1]) <= 1 && dx[0] > 30,
    `dx ${dx.join("/")} dy ${dy.join("/")}`
  );

  /* ---- a group locks as one object ---- */
  await selbar.getByLabel("Lock selection").click();
  await page.waitForTimeout(220);
  check(`${label}: the bar flips to Unlock`, await selbar.getByLabel("Unlock selection").isVisible());
  await tapLayer("ALPHA");
  const editorUnlock = page.locator(".rot-panel").getByRole("button", { name: "Unlock", exact: true });
  check(`${label}: stepping in reports the group as locked`, await editorUnlock.isVisible());
  await editorUnlock.click();
  await page.waitForTimeout(220);
  check(
    `${label}: unlocking from the editor frees the group`,
    await page.locator(".rot-panel").getByRole("button", { name: "Lock", exact: true }).isVisible()
  );

  /* ---- tap again to step inside, tap again to pick the group back up ---- */
  await closeSheet();
  await tapLayer("ALPHA");
  check(`${label}: the group frame is back`, (await frames.count()) === 1);
  await tapLayer("ALPHA");
  check(`${label}: the second tap steps in and opens that element`, await editor.isVisible());
  check(`${label}: stepping in drops the group frame`, (await frames.count()) === 0);

  /* ---- duplicate the whole group from the action bar ---- */
  await closeSheet();
  await tapLayer("ALPHA");
  await selbar.getByLabel("Duplicate selection").click();
  await page.waitForTimeout(300);
  check(`${label}: the duplicated group stays selected`, (await frames.count()) === 1);
  check(
    `${label}: duplicating a group copies every member`,
    (await page.locator(".rot-canvas-svg").first().getAttribute("aria-label"))?.includes("4 design elements") === true,
    await page.locator(".rot-canvas-svg").first().getAttribute("aria-label")
  );

  await openLayers();
  const duplicated = await rows.allInnerTexts();
  check(`${label}: the panel lists both copies`, duplicated.length === 4, `${duplicated.length} rows`);
  check(
    `${label}: the copies form their own group`,
    duplicated.filter((text) => /Group 1/.test(text)).length === 2 &&
      duplicated.filter((text) => /Group 2/.test(text)).length === 2,
    duplicated.join(" | ")
  );
  check(
    `${label}: the canvas pick survives opening the Layers panel`,
    (await page.locator(".rot-layerrow.is-on").count()) === 2,
    `${await page.locator(".rot-layerrow.is-on").count()} picked`
  );

  /* ---- ungroup just the copies ---- */
  await pickRows([0, 1]);
  await page.locator(".rot-layeractions .rot-cta").first().click();
  await page.waitForTimeout(250);
  const released = await rows.allInnerTexts();
  check(`${label}: ungrouping removes the group frame`, (await frames.count()) === 0);
  check(
    `${label}: only the ungrouped copies are released`,
    released.filter((text) => /Group 1/.test(text)).length === 2 &&
      !released.some((text) => /Group 2/.test(text)),
    released.join(" | ")
  );

  if (mobile) {
    const overflow = await page.locator("body").evaluate((node) => node.scrollWidth - window.innerWidth);
    check(`${label}: the customizer never scrolls sideways`, overflow <= 1, `${overflow}px`);
  }
  check(`${label}: no runtime errors`, errors.length === 0, errors.slice(0, 2).join(" | "));

  await context.close();
}

try {
  await run("desktop", { width: 1366, height: 900 }, false);
  await run("phone", { width: 390, height: 844 }, true);
} finally {
  await browser.close();
}

console.log(failures ? `\n${failures} FAILED` : "\nall grouping checks passed");
process.exit(failures ? 1 : 0);
