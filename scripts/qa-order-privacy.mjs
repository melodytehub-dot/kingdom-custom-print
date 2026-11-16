/**
 * Browser regression for customer-order privacy.
 *
 * Creates one uniquely named fixture, proves a reference alone reveals no
 * order progress or private details, then verifies two authorized paths: the
 * checkout email for a guest and the owning account session. Exact fixture rows
 * are deleted afterwards; this script never resets or seeds the database.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { DatabaseSync } from "node:sqlite";

const BASE = process.env.QA_BASE ?? "http://localhost:3000";
const file = process.env.LOCAL_DB_PATH ?? ".local-db/store.sqlite";
const db = new DatabaseSync(file);
db.exec("PRAGMA foreign_keys = ON;");

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
  const accountId = Number(
    db
      .prepare("INSERT INTO customer_accounts (email, name, password_hash, email_verified) VALUES (?, ?, 'qa-test-only', 1)")
      .run(email, "QA Privacy Owner").lastInsertRowid
  );
  db.prepare("INSERT INTO customer_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)").run(
    tokenHash,
    accountId,
    new Date(Date.now() + 3600 * 1000).toISOString()
  );
  const orderId = Number(
    db
      .prepare(
        `INSERT INTO orders
          (reference, account_id, email, name, address_line1, city, region, postal,
           status, subtotal, shipping, total, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 123.45, 6.95, 130.40, ?)`
      )
      .run(reference, accountId, email, "QA Privacy Owner", "101 Private Test Lane", "Austin", "TX", "78701", secretNote)
      .lastInsertRowid
  );
  db.prepare(
    `INSERT INTO order_items
      (order_id, product_name, product_kind, color_name, color_hex,
       unit_price, quantity, size_breakdown, design, notes)
     VALUES (?, ?, 'tee', 'Black', '#111111', 123.45, 1, ?, ?, ?)`
  ).run(
    orderId,
    productName,
    JSON.stringify([{ label: "M", qty: 1 }]),
    JSON.stringify({ front: [{ type: "text", text: secretNote }], back: [] }),
    secretNote
  );

  browser = await chromium.launch({ channel: process.env.QA_BROWSER ?? "chrome", headless: true });

  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(`${BASE}/order/${reference}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await publicPage.waitForTimeout(800);
  const publicBody = await publicPage.locator("body").innerText();
  assert.match(publicBody, new RegExp(reference));
  assert.match(publicBody, /verify to view full order details/i);
  mustHide(publicBody, email, "checkout email");
  mustHide(publicBody, productName, "line item");
  mustHide(publicBody, secretNote, "design/order note");
  mustHide(publicBody, "$130.40", "order total");
  assert.equal(
    /order progress|order status|pending|in production|shipped/i.test(publicBody),
    false,
    "reference-only visitor should not see order tracking"
  );
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
  await ownerContext.addCookies([
    {
      name: "kcp_customer",
      value: accountToken,
      url: BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto(`${BASE}/order/${reference}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await ownerPage.waitForTimeout(800);
  const ownerBody = await ownerPage.locator("body").innerText();
  assert.ok(ownerBody.includes(productName));
  assert.ok(ownerBody.includes(secretNote));
  console.log("PASS the account that owns the order can view full details");
  await ownerContext.close();
} finally {
  if (browser) await browser.close();
  db.prepare("DELETE FROM orders WHERE reference = ?").run(reference);
  db.prepare("DELETE FROM customer_accounts WHERE email = ?").run(email);
  db.close();
}

console.log("ALL ORDER PRIVACY CHECKS PASSED");
