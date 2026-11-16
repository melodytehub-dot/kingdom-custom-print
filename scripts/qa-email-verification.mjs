/**
 * Email confirmation lifecycle: an unconfirmed account gets no session, the
 * styled email carries a working link, confirming activates once, and the link
 * cannot be reused.
 */
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { DatabaseSync } from "node:sqlite";

const base = process.env.QA_BASE ?? "http://localhost:3005";
const mailFile = process.env.KCP_MOCK_MAIL_FILE ?? ".local-db/qa-mail.json";
const email = `qa-verification-${Date.now()}@example.com`;
const password = "LocalVerificationTest2026";
const db = new DatabaseSync(process.env.LOCAL_DB_PATH ?? ".local-db/store.sqlite");
db.exec("PRAGMA foreign_keys = ON;");

async function readMail() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const mail = JSON.parse(await readFile(mailFile, "utf8"));
      if (mail.to?.[0] === email) return mail;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Confirmation email was not captured: ${lastError?.message ?? "no mail"}`);
}

const browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/account`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("heading", { name: "Welcome back" }).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("Verification QA");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).last().click();
  await page.getByText(/Check your inbox/i).waitFor({ timeout: 30000 });

  if ((await page.context().cookies()).some((cookie) => cookie.name === "kcp_customer")) {
    throw new Error("An unverified account received a session");
  }

  const mail = await readMail();
  if (!mail.html?.includes("Confirm email")) throw new Error("The confirmation email was not prepared");
  const path = mail.text?.match(/\/account\/verify\?token=[a-f0-9]{64}/)?.[0];
  if (!path) throw new Error("The confirmation link is missing");
  const url = `${base}${path}`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  const before = db.prepare("SELECT email_verified FROM customer_accounts WHERE email = ?").get(email);
  if (before?.email_verified) throw new Error("Opening the link verified the account without confirmation");

  await page.getByRole("button", { name: "Confirm email" }).click();
  await page.waitForURL(/verification=success/, { timeout: 30000 });
  await page.getByText(/Email confirmed/i).first().waitFor({ timeout: 30000 });
  if (db.prepare("SELECT email_verified FROM customer_accounts WHERE email = ?").get(email)?.email_verified !== 1) {
    throw new Error("The confirmation did not activate the account");
  }

  await page.getByLabel("Email address").last().fill(email);
  await page.getByLabel("Password").last().fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.getByRole("heading", { name: "Your account" }).waitFor({ timeout: 30000 });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: "Confirm email" }).click();
  await page.getByText(/invalid or expired/i).first().waitFor({ timeout: 30000 });
  console.log("PASS registration requires confirmation, sends a styled message, activates once, and permits sign-in");
} finally {
  await browser.close();
  db.prepare("DELETE FROM customer_accounts WHERE email = ?").run(email);
  db.close();
}
