import { chromium } from "playwright";
import postgres from "postgres";
import { readFile } from "node:fs/promises";

const base = process.env.QA_BASE ?? "http://localhost:3005";
const email = `qa-verification-${Date.now()}@example.com`;
const password = "LocalVerificationTest2026";
const db = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });
const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/account`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("Verification QA");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).last().click();
  await page.getByText(/check your inbox/i).waitFor();
  if (await page.context().cookies().then(c => c.some(x => x.name === "kcp_customer"))) throw new Error("Unverified account received a session");
  const mail = JSON.parse(await readFile(process.env.KCP_MOCK_MAIL_FILE, "utf8"));
  if (mail.to[0] !== email || !mail.html?.includes("Confirm email")) throw new Error("Confirmation email was not prepared");
  const path = mail.text.match(/\/account\/verify\?token=[a-f0-9]{64}/)?.[0];
  if (!path) throw new Error("Missing confirmation link");
  const url = `${base}${path}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  const [before] = await db`select email_verified from customer_accounts where email=${email}`;
  if (before?.email_verified) throw new Error("Opening the link verified without confirmation");
  await page.getByRole("button", { name: "Confirm email" }).click();
  await page.getByText(/email confirmed/i).waitFor();
  await page.waitForTimeout(2000);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.getByRole("heading", { name: "Your account" }).waitFor();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: "Confirm email" }).click();
  await page.getByText(/invalid or expired/i).waitFor();
  console.log("PASS registration requires confirmation, sends a styled message, activates once, and permits sign-in");
} finally {
  await browser.close();
  await db`delete from customer_accounts where email=${email}`;
  await db.end();
}
