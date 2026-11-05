import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.env.QA_BASE ?? "http://localhost:3000";
const routes = ["/","/shop","/customize","/product/crown-classic-tee","/contact","/about","/faq","/shipping","/privacy","/terms","/wishlist","/cart","/checkout","/account","/admin"];
let failures=0;
try {
 for (const width of process.env.QA_INTERACTIONS_ONLY ? [] : [390,768,1440]) {
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:"reduce"});
  for (const route of routes) {
   try {
    const response=await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:60000});
    assert.ok(response.status()<400,`HTTP ${response.status()}`);
    await page.locator("body").waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"horizontal overflow");
    assert.equal(await page.getByText("This page did not load",{exact:true}).count(),0,"site error page");
    console.log(`PASS ${width} ${route}`);
   } catch(e) {failures++;console.log(`FAIL ${width} ${route}: ${e.message.split("\n")[0]}`);}
  }
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(base,{waitUntil:"domcontentloaded",timeout:60000});
 await page.getByRole("button",{name:"Your design",exact:true}).click();
 assert.equal(await page.getByRole("button",{name:"Your design",exact:true}).getAttribute("aria-pressed"),"true");
 await page.getByRole("heading",{name:"Make it your own",exact:true}).waitFor();
 await page.getByRole("button",{name:"The blank",exact:true}).click();
 await page.getByRole("heading",{name:"Choose your canvas",exact:true}).waitFor();
 await page.locator(".kcp-questions-inner > div").first().scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector(".kcp-questions-inner > div")?.classList.contains("kcp-revealed"));
 await page.locator(".kcp-faq-list summary").filter({hasText:"What can I add to a design?"}).click();
 await page.getByText(/You can add text, choose graphics/).waitFor();
 await page.getByRole("button",{name:"Open menu",exact:true}).click();
 await page.getByRole("dialog",{name:"Site menu"}).waitFor();
 await page.keyboard.press("Escape");
 assert.equal(await page.getByRole("dialog",{name:"Site menu"}).count(),0);
 const longImage=page.locator(".kcp-category").filter({hasText:"Long sleeves"}).locator("img");
 assert.match(await longImage.getAttribute("src"),/long-sleeves/);
 await longImage.scrollIntoViewIfNeeded(); await page.waitForFunction(()=>{const img=[...document.querySelectorAll(".kcp-category")].find(x=>x.textContent.includes("Long sleeves"))?.querySelector("img");return img?.complete&&img.naturalWidth>0});
 const slide=page.getByRole("button",{name:/Show photo 2/}); await slide.click(); assert.equal(await slide.getAttribute("aria-pressed"),"true");
 assert.equal(await page.locator(".mm-header").evaluate(el=>getComputedStyle(el).backdropFilter.includes("blur")),true);
 assert.equal(await page.locator(".kcp-hero h1").evaluate(el=>getComputedStyle(el).animationName),"kcp-enter");
 console.log("PASS story controls, FAQ, keyboard menu, slideshow, glass header and loaded long-sleeve asset");
 await page.goto(base+"/product/crown-classic-tee"); await page.getByRole("button",{name:"View size chart"}).click(); await page.getByRole("dialog").waitFor(); await page.getByRole("button",{name:/close/i}).first().click(); assert.equal(await page.getByRole("dialog").count(),0); console.log("PASS product size-chart popup");
 await page.goto(base+"/customize/crown-classic-tee"); await page.locator(".rot").waitFor(); assert.equal(await page.locator(".rot").evaluate(el=>getComputedStyle(el).getPropertyValue("--rot-accent").trim()),"#bd263b"); console.log("PASS design studio uses brand accent");
 await page.close();
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce"});
 await reduced.goto(base,{waitUntil:"domcontentloaded"});
 assert.ok(await reduced.locator(".kcp-hero h1").evaluate(el=>parseFloat(getComputedStyle(el).animationDuration)<=0.001));
 await reduced.close(); console.log("PASS reduced-motion preference");
} finally {await browser.close()}
if(failures) process.exit(1);
