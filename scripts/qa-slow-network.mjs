import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const client = await page.context().newCDPSession(page);
const errors = [];

page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error" && !/favicon|404 \(Not Found\)/i.test(message.text())) errors.push(message.text());
});

await client.send("Network.enable");
await client.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 350,
  downloadThroughput: (1.5 * 1024 * 1024) / 8,
  uploadThroughput: (512 * 1024) / 8,
  connectionType: "cellular3g",
});

const routes = [
  { path: "/", ready: () => page.getByRole("heading", { name: /YOUR IDEAS/i }).first() },
  { path: "/shop", ready: () => page.getByRole("heading", { name: /FIND YOUR NEXT FAVORITE/i }) },
  { path: "/customize/crown-classic-tee", ready: () => page.locator("image.rot-shirt-photo").first() },
  { path: "/account", ready: () => page.getByRole("heading", { name: "Welcome back" }) },
];

try {
  for (const route of routes) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await route.ready().waitFor({ state: "visible", timeout: 60_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${route.path} overflows by ${overflow}px on a throttled phone load`);
    console.log(`PASS ${route.path} becomes usable on a throttled phone connection`);
  }
  if (errors.length) throw new Error(`Browser errors: ${errors.slice(0, 3).join(" | ")}`);
  console.log("PASS throttled routes produce no browser errors");
} finally {
  await browser.close();
}
