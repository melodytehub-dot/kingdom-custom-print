import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for exact QA fixture cleanup.");

const sql = postgres(databaseUrl, { max: 1 });
const marker = `qa-account-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `${marker}@example.test`;
const password = "QA-only-passphrase-2026";
let browser;

function check(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

try {
  browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  check(await page.getByRole("heading", { name: "Welcome back" }).isVisible(), "guest sees account access screen");

  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("QA Account Fixture");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).last().click();
  await page.getByRole("heading", { name: "Your account" }).waitFor();
  check(await page.getByText(email).isVisible(), "registration signs the new customer in");
  check(await page.getByText("Orders you place while signed in will appear here.").isVisible(), "new account has a useful empty state");

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("heading", { name: "Welcome back" }).waitFor();
  check(true, "sign-out returns to the guest account screen");

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  const loginError = page.getByRole("alert").getByText("Email or password is incorrect.");
  await loginError.waitFor();
  check(await loginError.isVisible(), "invalid password is rejected without revealing account details");

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page.getByRole("heading", { name: "Your account" }).waitFor();
  check(await page.getByText(email).isVisible(), "registered customer can sign back in");
} finally {
  if (browser) await browser.close();
  const accounts = await sql`SELECT id FROM customer_accounts WHERE email = ${email}`;
  if (accounts.length) {
    await sql`DELETE FROM customer_accounts WHERE email = ${email}`;
  }
  await sql.end();
}
