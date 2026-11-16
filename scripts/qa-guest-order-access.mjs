/**
 * Guest order access: the order email is required, a session only opens the
 * order it was issued for, sessions expire, and repeated guesses are limited.
 */
import assert from "node:assert/strict";
import { createHarness } from "./qa-harness.mjs";

const harness = await createHarness({ name: "guest-order-access" });
const { db, load } = harness;
const access = await load("/lib/order-access.ts");

db.prepare("INSERT INTO orders (id, reference, email, name, status) VALUES (1, 'KCP-AAAAAA', 'buyer@example.test', 'Buyer', 'paid')").run();
db.prepare("INSERT INTO orders (id, reference, email, name, status) VALUES (2, 'KCP-BBBBBB', 'other@example.test', 'Other', 'paid')").run();

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  check("the wrong email cannot open an order", (await access.verifyGuestOrder("KCP-AAAAAA", "wrong@example.test")) === null);

  const token = await access.verifyGuestOrder("KCP-AAAAAA", "BUYER@example.test");
  check("the checkout email opens a session", /^[A-Za-z0-9_-]{43}$/.test(token ?? ""));
  check("the session opens its own order", (await access.guestCanAccessOrder("KCP-AAAAAA", token)) === true);
  check("the session does not open another order", (await access.guestCanAccessOrder("KCP-BBBBBB", token)) === false);
  check("an invalid token is refused", (await access.guestCanAccessOrder("KCP-AAAAAA", "invalid")) === false);

  db.prepare("UPDATE order_access_sessions SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
  check("an expired session is refused", (await access.guestCanAccessOrder("KCP-AAAAAA", token)) === false);

  check("a missing order has no session", (await access.verifyGuestOrder("KCP-ZZZZZZ", "buyer@example.test")) === null);

  const request = new Request("https://example.test/track", { headers: { "cf-connecting-ip": "203.0.113.9" } });
  const results = [];
  for (let attempt = 0; attempt < 11; attempt += 1) {
    results.push(await access.orderAccessAttemptAllowed(request, "KCP-AAAAAA"));
  }
  check("ten access attempts are allowed", results.slice(0, 10).every(Boolean));
  check("the eleventh attempt is blocked", results[10] === false);
  const otherIp = new Request("https://example.test/track", { headers: { "cf-connecting-ip": "203.0.113.10" } });
  check("another address has its own limit", (await access.orderAccessAttemptAllowed(otherIp, "KCP-AAAAAA")) === true);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} guest order access check(s) failed` : "\nall guest order access checks passed");
process.exit(failures ? 1 : 0);
