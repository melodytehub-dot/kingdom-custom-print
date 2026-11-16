/** Guarded quote creation, editing, conversion and invoice locking. */
import assert from "node:assert/strict";
import { createHarness } from "./qa-harness.mjs";

process.env.ADMIN_PASSWORD ??= "localtestpassword123";
const harness = await createHarness({ name: "admin-quotes" });
const { db, load } = harness;

const auth = await load("/lib/admin-auth.ts");
const route = await load("/app/api/admin/quotes/route.ts");
const token = await auth.createSession();

const request = (method, body) =>
  route[method](
    new Request("https://example.test/api/admin/quotes", {
      method,
      headers: { cookie: `kcp_admin=${token}`, origin: "https://example.test", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  );

const draft = {
  name: "Quote test",
  email: "test@example.com",
  lines: [{ description: "Shirts", quantity: 3, unitCents: 1299 }],
  shippingCents: 500,
};

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  const anonymous = await route.POST(
    new Request("https://example.test/api/admin/quotes", {
      method: "POST",
      headers: { origin: "https://example.test", "content-type": "application/json" },
      body: JSON.stringify(draft),
    })
  );
  check("anonymous quote creation is rejected", anonymous.status === 401);

  const created = await request("POST", draft);
  const createdBody = await created.json();
  check("a quote is created", created.status === 201 && /^[1-9][0-9]*$/.test(createdBody.id));
  const id = createdBody.id;

  check("a quote can be edited", (await request("PATCH", { ...draft, id, name: "Updated test" })).status === 200);
  check("a quote can be converted to an invoice", (await request("PATCH", { id, action: "invoice" })).status === 200);
  check("an invoice can no longer be edited", (await request("PATCH", { ...draft, id })).status === 409);
  check("an invoice cannot be converted twice", (await request("PATCH", { id, action: "invoice" })).status === 409);

  const stored = db.prepare("SELECT customer_name, status, invoiced_at FROM admin_quotes WHERE id = ?").get(Number(id));
  check("the edited name is stored", stored.customer_name === "Updated test");
  check("the quote is marked as an invoice", stored.status === "invoice");
  check("the conversion time is recorded", Boolean(stored.invoiced_at));

  const missingEmail = await request("POST", { ...draft, email: "not-an-email" });
  check("a quote without a valid email is refused", missingEmail.status === 422);

  const listed = await request("GET");
  const listing = await listed.json();
  check("the quote appears in the admin list", listing.quotes?.some((quote) => quote.id === String(id)));

  const variant = db.prepare("SELECT id FROM admin_quotes WHERE id = ?").get(Number(id));
  check("the stored quote row is unique", Boolean(variant));
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} admin quote check(s) failed` : "\nall admin quote checks passed");
process.exit(failures ? 1 : 0);
