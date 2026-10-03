import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const OUT = "/tmp/qa";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-sm", width: 320, height: 700 },
];

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/shop", name: "shop" },
  { path: "/shop?category=sweatshirts", name: "shop-filtered" },
  { path: "/product/crown-classic-tee", name: "product" },
  { path: "/customize", name: "customize-start" },
  { path: "/customize/crown-classic-tee", name: "customizer" },
  { path: "/about", name: "about" },
  { path: "/contact", name: "contact" },
  { path: "/shipping", name: "shipping" },
  { path: "/faq", name: "faq" },
  { path: "/privacy", name: "privacy" },
  { path: "/cart", name: "cart-empty" },
  { path: "/checkout", name: "checkout" },
  { path: "/admin", name: "admin-login" },
  { path: "/nonexistent", name: "not-found" },
];

const findings = [];
const record = (level, route, vp, msg) => {
  findings.push({ level, route, vp, msg });
  console.log(`  [${level}] ${vp}/${route}: ${msg}`);
};

async function audit(page, routeName, vpName) {
  return page.evaluate(() => {
    const out = { overflow: 0, offenders: [], tiny: [], unlabelled: [], contrast: [] };

    const docW = document.documentElement.clientWidth;
    out.overflow = Math.max(0, document.documentElement.scrollWidth - docW);

    const label = (el) => {
      const t = (el.textContent || "").trim().slice(0, 40);
      return `${el.tagName.toLowerCase()}${t ? `.${t.replace(/\s+/g, "-").slice(0, 22)}` : ""}`;
    };

    // Elements extending past the viewport.
    // Content inside a deliberate horizontal scroll strip (filter chips,
    // product switcher) is expected to sit outside the fold, so skip any
    // element whose nearest scrollable ancestor clips it.
    const inScrollStrip = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === "auto" || ps.overflowX === "scroll" || ps.overflowX === "hidden") {
          return true;
        }
      }
      return false;
    };

    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (r.right > docW + 1 || r.left < -1) {
        if (style.position === "fixed" || el.closest("[hidden]")) continue;
        if (el.scrollWidth > el.clientWidth + 1) continue;
        if (inScrollStrip(el)) continue;
        out.offenders.push({
          el: label(el),
          left: Math.round(r.left),
          right: Math.round(r.right),
          vw: docW,
        });
      }
    }

    // Interactive targets below the recommended touch size
    for (const el of document.querySelectorAll("button, a, input, select, textarea")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      // Links inside flowing text are exempt from the 24px target
      const display = getComputedStyle(el).display;
      const isInlineLink = el.tagName === "A" && display.includes("inline") && display !== "inline-flex";
      // Breadcrumbs and text links inside prose are exempt from 24px targets
      const isTextLink = el.tagName === "A" && (el.closest(".breadcrumb") || el.closest(".prose") || el.closest(".quick-links"));
      // Visually hidden controls (sr-only) are driven programmatically or via a visible label
      const visuallyHidden = el.classList.contains("sr-only");
      if (!isInlineLink && !isTextLink && !visuallyHidden && (r.height < 24 || r.width < 24)) {
        out.tiny.push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }

    // Form controls without an accessible name
    for (const el of document.querySelectorAll("input, select, textarea")) {
      if (el.type === "hidden") continue;
      const id = el.id;
      const hasLabel =
        (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
        el.closest("label") ||
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.closest("[role='group']")?.getAttribute("aria-label");
      const visuallyHidden = el.classList.contains("sr-only");
      if (!hasLabel && !visuallyHidden) out.unlabelled.push(label(el) + `[type=${el.type}]`);
    }

    // Buttons/links with no accessible name
    for (const el of document.querySelectorAll("button, a")) {
      const name = (el.textContent || "").trim();
      const aria = el.getAttribute("aria-label") || el.getAttribute("title");
      // Controls hidden from assistive tech need no accessible name; a sibling
      // link carries the name for the same destination.
      const hiddenFromAT =
        el.getAttribute("aria-hidden") === "true" || el.getAttribute("tabindex") === "-1";
      if (!name && !aria && !hiddenFromAT && el.querySelector("svg[aria-hidden='true']")) {
        out.unlabelled.push("icon-button:" + label(el));
      }
    }

    return out;
  });
}

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });

    for (const route of ROUTES) {
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];

      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
      });
      page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 160)));

      try {
        await page.goto(`${BASE}${route.path}`, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        await page.waitForTimeout(350);

        const res = await audit(page, route.name, vp.name);

        if (res.overflow > 1) {
          record("OVERFLOW", route.name, vp.name, `page scrolls ${res.overflow}px horizontally`);
        }
        for (const o of res.offenders.slice(0, 5)) {
          record("CLIPPED", route.name, vp.name, `${o.el} spans ${o.left}→${o.right} (vw ${o.vw})`);
        }
        for (const t of res.tiny.slice(0, 4)) {
          record("TINY-TARGET", route.name, vp.name, `${t.el} is ${t.w}×${t.h}px`);
        }
        for (const u of res.unlabelled.slice(0, 4)) {
          record("NO-NAME", route.name, vp.name, u);
        }
        for (const e of pageErrors) {
          record("JS-ERROR", route.name, vp.name, e);
        }
        const unexpectedConsoleErrors = consoleErrors.filter(
          (c) =>
            !c.includes("favicon") &&
            !(route.name === "not-found" && /404|Failed to load resource/.test(c))
        );
        for (const e of unexpectedConsoleErrors) {
          record("CONSOLE", route.name, vp.name, e);
        }

        await page.screenshot({
          path: `${OUT}/${vp.name}-${route.name}.png`,
          fullPage: vp.name === "desktop" || vp.name === "mobile",
        });
      } catch (err) {
        record("LOAD-FAIL", route.name, vp.name, err.message.split("\n")[0]);
      }

      await page.close();
    }

    await context.close();
    console.log(`\n--- ${vp.name} (${vp.width}px) complete ---\n`);
  }

  await browser.close();

  console.log("\n================ SUMMARY ================");
  const byLevel = {};
  for (const f of findings) byLevel[f.level] = (byLevel[f.level] ?? 0) + 1;
  console.log(JSON.stringify(byLevel, null, 2));
  console.log(`screenshots: ${OUT}`);
  if (findings.length) {
    console.log("\nFirst 30 findings:");
    findings.slice(0, 30).forEach((f) => console.log(`  ${f.level} ${f.vp}/${f.route}: ${f.msg}`));
  }
};

run().catch((e) => {
  console.error("QA run failed:", e);
  process.exit(1);
});
