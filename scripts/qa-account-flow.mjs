/**
 * Customer account flow against a disposable SQLite database: registration
 * waits for email confirmation, then sign-in, sign-out and a rejected password.
 * Requires the dev server to point RESEND_API_URL at scripts/mock-mail.mjs.
 */
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { DatabaseSync } from "node:sqlite";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const mailFile = process.env.KCP_MOCK_MAIL_FILE ?? ".local-db/qa-mail.json";
const file = process.env.LOCAL_DB_PATH ?? ".local-db/store.sqlite";
const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys = ON;");

const marker = `qa-account-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `${marker}@example.test`;
const password = "QA-only-passphrase-2026";
let browser;

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

async function confirmationPath() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const mail = JSON.parse(await readFile(mailFile, "utf8"));
      if (mail.to?.[0] !== email) throw new Error("Waiting for the confirmation email");
      const path = mail.text?.match(/\/account\/verify\?token=[a-f0-9]{64}/)?.[0];
      if (path) return path;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Confirmation link was not captured: ${lastError?.message ?? "no mail"}`);
}

try {
  browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("heading", { name: "Welcome back" }).waitFor({ timeout: 60000 });
  check(true, "guest sees the account access screen");

  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("QA Account Fixture");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).last().click();
  await page.getByText(/Check your inbox for a confirmation link/i).waitFor({ timeout: 30000 });
  check(
    (await page.context().cookies()).every((cookie) => cookie.name !== "kcp_customer"),
    "an unconfirmed account receives no session"
  );

  const before = db.prepare("SELECT email_verified FROM customer_accounts WHERE email = ?").get(email);
  check(before?.email_verified === 0, "registration stores the account as unconfirmed");

  const path = await confirmationPath();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  check(
    db.prepare("SELECT email_verified FROM customer_accounts WHERE email = ?").get(email)?.email_verified === 0,
    "opening the confirmation link does not verify by itself"
  );
  await page.getByRole("button", { name: "Confirm email" }).click();
  await page.waitForURL(/verification=success/, { timeout: 30000 });
  await page.getByText(/Email confirmed/i).first().waitFor({ timeout: 30000 });

  await page.getByLabel("Email address").last().fill(email);
  await page.getByLabel("Password").last().fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.getByRole("alert").getByText("Email or password is incorrect.").waitFor();
  check(await page.getByText("Email or password is incorrect.").isVisible(), "an invalid password is rejected without revealing account details");

  await page.getByLabel("Password").last().fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.getByRole("heading", { name: "Your account" }).waitFor({ timeout: 30000 });
  check(await page.getByText(email).isVisible(), "the confirmed customer can sign in");
  check(
    await page.getByText("Orders you place while signed in will appear here.").isVisible(),
    "a new account has a useful empty state"
  );

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  check(true, "sign-out returns to the guest account screen");

  await page.getByLabel("Email address").last().fill(email);
  await page.getByLabel("Password").last().fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.getByRole("heading", { name: "Your account" }).waitFor();
  check(await page.getByText(email).isVisible(), "the registered customer can sign back in");
} finally {
  if (browser) await browser.close();
  db.prepare("DELETE FROM customer_accounts WHERE email = ?").run(email);
  db.close();
}
