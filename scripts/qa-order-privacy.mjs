/**
 * Browser regression for customer-order privacy.
 *
 * Creates one uniquely named fixture, proves a reference alone reveals no
 * order progress or private details, then verifies two authorized paths: checkout-email
 * proof for a guest and an owning account session. Exact fixture rows are
 * deleted in finally; this script never resets or seeds the database.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required");

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const suffix = Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join("");
const reference = `KCP-${suffix}`;
const email = `qa-order-${suffix.toLowerCase()}@example.test`;
const productName = `Private QA garment ${suffix}`;
const secretNote = `PRIVATE-NOTE-${suffix}`;
const accountToken = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(accountToken).digest("hex");
let browser;

function mustHide(body, value, label) {
  assert.equal(body.includes(value), false, `${label} leaked to a reference-only visitor`);
}

try {
  const [account] = await sql`
    INSERT INTO customer_accounts (email, name, password_hash)
    VALUES (${email}, ${"QA Privacy Owner"}, ${"qa-test-only"})
    RETURNING id`;
  await sql`
    INSERT INTO customer_sessions (token_hash, account_id, expires_at)
    VALUES (${tokenHash}, ${account.id}, now() + interval '1 hour')`;
  const [order] = await sql`
    INSERT INTO orders
      (reference, account_id, email, name, address_line1, city, region, postal,
       status, subtotal, shipping, total, notes)
    VALUES
      (${reference}, ${account.id}, ${email}, ${"QA Privacy Owner"},
       ${"101 Private Test Lane"}, ${"Austin"}, ${"TX"}, ${"78701"},
       ${"pending"}, ${123.45}, ${6.95}, ${130.40}, ${secretNote})
    RETURNING id`;
  await sql`
    INSERT INTO order_items
      (order_id, product_name, product_kind, color_name, color_hex,
       unit_price, quantity, size_breakdown, design, notes)
    VALUES
      (${order.id}, ${productName}, ${"tee"}, ${"Black"}, ${"#111111"},
       ${123.45}, ${1}, ${sql.json([{ label: "M", qty: 1 }])},
       ${sql.json({ front: [{ type: "text", text: secretNote }], back: [] })},
       ${secretNote})`;

  browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });

  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`${BASE}/order/${reference}`, { waitUntil: "networkidle" });
  const publicBody = await publicPage.locator("body").innerText();
  assert.match(publicBody, new RegExp(reference));
  assert.match(publicBody, /verify to view full order details/i);
  mustHide(publicBody, email, "checkout email");
  mustHide(publicBody, productName, "line item");
  mustHide(publicBody, secretNote, "design/order note");
  mustHide(publicBody, "$130.40", "order total");
  assert.equal(/order progress|order status|pending|in production|shipped/i.test(publicBody), false, "reference-only visitor should not see order tracking");
  console.log("PASS reference alone shows no progress or private order details");

  await publicPage.getByLabel("Checkout email").fill(email);
  await publicPage.getByRole("button", { name: "View full order" }).click();
  await publicPage.getByText(productName).waitFor({ state: "visible" });
  const verifiedBody = await publicPage.locator("body").innerText();
  assert.ok(verifiedBody.includes(email));
  assert.ok(verifiedBody.includes(secretNote));
  assert.ok(verifiedBody.includes("$130.40"));
  console.log("PASS exact checkout email grants a short-lived full-order session");
  await publicContext.close();

  const ownerContext = await browser.newContext();
  await ownerContext.addCookies([{
    name: "kcp_customer",
    value: accountToken,
    url: BASE,
    httpOnly: true,
    sameSite: "Lax",
  }]);
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto(`${BASE}/order/${reference}`, { waitUntil: "networkidle" });
  const ownerBody = await ownerPage.locator("body").innerText();
  assert.ok(ownerBody.includes(productName));
  assert.ok(ownerBody.includes(secretNote));
  console.log("PASS the account that owns the order can view full details");
  await ownerContext.close();
} finally {
  if (browser) await browser.close();
  await sql`DELETE FROM orders WHERE reference = ${reference}`;
  await sql`DELETE FROM customer_accounts WHERE email = ${email}`;
  await sql.end();
}

console.log("ALL ORDER PRIVACY CHECKS PASSED");
