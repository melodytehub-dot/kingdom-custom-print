/**
 * Checks the custom page builder against an isolated development server.
 * Never run this against a live storefront: it creates a page.
 *
 *   QA_BASE=http://localhost:3026 QA_EDITOR_PASSWORD=... node scripts/qa-custom-pages.mjs
 */
import assert from "node:assert/strict";

const base = process.env.QA_BASE;
const password = process.env.QA_EDITOR_PASSWORD;
if (!base || !password) throw new Error("Set QA_BASE and QA_EDITOR_PASSWORD for an isolated development server.");

const cookies = new Map();
async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-forwarded-for", process.env.QA_FORWARDED_FOR ?? `198.51.100.${Math.floor(Math.random() * 200) + 20}`);
  if (cookies.size) headers.set("cookie", [...cookies].map(([name, value]) => `${name}=${value}`).join("; "));
  const response = await fetch(`${base}${path}`, { ...init, headers, redirect: "manual" });
  for (const cookie of response.headers.getSetCookie?.() ?? []) {
    const [pair] = cookie.split(";");
    const [name, ...rest] = pair.split("=");
    cookies.set(name, rest.join("="));
  }
  return response;
}

const login = await request("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
assert.equal(login.status, 200, "sign in");

async function pageStatus(slug) {
  const response = await request(`/${slug}`);
  return response.status;
}

/** True when the address shows the storefront's not-found page. */
async function isMissing(slug) {
  const response = await request(`/${slug}`);
  const html = await response.text();
  const title = (html.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "";
  return title.startsWith("Page not found");
}

async function savePage(page) {
  const response = await request("/api/admin/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", page }) });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const stamp = Date.now().toString(36);
const slug = `qa-page-${stamp}`;
const page = {
  id: crypto.randomUUID(),
  slug,
  title: "QA size guide",
  description: "How to choose a size.",
  published: false,
  updatedAt: new Date().toISOString(),
  blocks: [
    { id: crypto.randomUUID(), type: "heading", text: "Measure twice" },
    { id: crypto.randomUUID(), type: "paragraph", text: "Lay a shirt you already own flat and measure across the chest." },
    { id: crypto.randomUUID(), type: "button", text: "Shop blanks", href: "/shop" },
    { id: crypto.randomUUID(), type: "faq", items: [{ question: "Do sizes run true?", answer: "Yes, our blanks use standard US sizing." }] },
  ],
};

assert.equal(await isMissing(slug), true, "an unpublished page is not on the site");

const created = await savePage(page);
assert.equal(created.status, 200, `page saves: ${JSON.stringify(created.body)}`);
assert.equal(created.body.pages.find(item => item.slug === slug)?.published, false);

const duplicate = await savePage({ ...page, id: crypto.randomUUID() });
assert.equal(duplicate.status, 409, "duplicate addresses are rejected");

const reserved = await savePage({ ...page, id: crypto.randomUUID(), slug: "shop" });
assert.equal(reserved.status, 422, "existing routes cannot be replaced");

const unsafeLink = await savePage({ ...page, blocks: [{ id: crypto.randomUUID(), type: "button", text: "Go", href: "https://example.com" }] });
assert.equal(unsafeLink.status, 422, "off-site button links are rejected");

const published = await savePage({ ...page, published: true });
assert.equal(published.status, 200, "page publishes");

const rendered = await request(`/${slug}`);
assert.equal(rendered.status, 200, "published page renders");
const html = await rendered.text();
assert.match(html, /QA size guide/, "page title renders");
assert.match(html, /Measure twice/, "heading block renders");
assert.match(html, /measure across the chest/, "paragraph block renders");
assert.match(html, /href="\/shop"/, "button block links to the shop");
assert.match(html, /Do sizes run true\?/, "question block renders");
assert.match(html, /Shop blanks/, "button label renders");

const renamed = await savePage({ ...page, slug: `${slug}-moved`, published: true });
assert.equal(renamed.status, 200, "page address can change");
assert.equal(await isMissing(slug), true, "the old address stops working");
assert.equal(await isMissing(`${slug}-moved`), false, "the new address works");

const removed = await request("/api/admin/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: page.id }) });
assert.equal(removed.status, 200, "page deletes");
assert.equal(await isMissing(`${slug}-moved`), true, "a deleted page is gone");

const anonymous = await fetch(`${base}/api/admin/pages`);
assert.equal(anonymous.status, 401, "page management requires signing in");

await request("/api/admin/logout", { method: "POST" });
console.log("PASS custom pages save, publish, render, rename, and delete");
