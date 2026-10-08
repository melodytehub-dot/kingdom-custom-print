import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });

async function probe(path, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });

  const res = await page.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const hits = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.position === "fixed") continue;
      if (r.right > docW + 1) {
        // walk ancestors to see if a scroll container clips it
        let scrollParent = null;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ps = getComputedStyle(p);
          if (ps.overflowX === "auto" || ps.overflowX === "scroll" || ps.overflowX === "hidden") {
            scrollParent = p.className || p.tagName;
            break;
          }
        }
        hits.push({
          el: el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : ""),
          right: Math.round(r.right),
          width: Math.round(r.width),
          scrollParent,
          overflowX: s.overflowX,
        });
      }
    }
    return {
      docW,
      scrollW: document.documentElement.scrollWidth,
      bodyScrollW: document.body.scrollWidth,
      hits: hits.slice(0, 14),
    };
  });

  console.log(`\n=== ${path} @ ${width}px ===`);
  console.log(`clientWidth ${res.docW}  scrollWidth ${res.scrollW}  bodyScrollWidth ${res.bodyScrollW}`);
  if (res.scrollW <= res.docW + 1) console.log("no horizontal overflow");
  for (const h of res.hits) {
    console.log(
      `  ${h.el} right=${h.right} w=${h.width} overflowX=${h.overflowX} scrollParent=${h.scrollParent ?? "none"}`
    );
  }
  await ctx.close();
}

await probe("/customize/crown-classic-tee", 390);
await probe("/customize/crown-classic-tee", 320);
await probe("/customize/crown-classic-tee", 1280);
await probe("/shop", 390);

await browser.close();
