/**
 * Checks homepage version history against an isolated development server.
 * Never run this against a live storefront: it publishes test layouts.
 *
 *   QA_BASE=http://localhost:3026 QA_EDITOR_PASSWORD=... node scripts/qa-homepage-history.mjs
 */
import assert from "node:assert/strict";

const base = process.env.QA_BASE;
const password = process.env.QA_EDITOR_PASSWORD;
if (!base || !password) throw new Error("Set QA_BASE and QA_EDITOR_PASSWORD for an isolated development server.");

const cookies = new Map();
const forwardedFor = process.env.QA_FORWARDED_FOR ?? `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-forwarded-for", forwardedFor);
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

async function draft() {
  const response = await request("/api/admin/homepage-draft", { cache: "no-store" });
  assert.equal(response.status, 200, "draft loads");
  return response.json();
}

async function save(layout, revision) {
  const response = await request("/api/admin/homepage-draft", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...layout, expectedRevision: revision }) });
  assert.equal(response.status, 200, "draft saves");
  return (await response.json()).revision;
}

async function publish(layout, revision) {
  const response = await request("/api/admin/homepage-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", layout, expectedRevision: revision }) });
  const body = await response.text();
  assert.equal(response.status, 200, `publish succeeds: ${body}`);
  return JSON.parse(body);
}

const initial = await draft();
assert.ok(Array.isArray(initial.history), "draft response includes the version list");

// Start from the live homepage so the checks are not affected by an older draft.
let state = initial;
if (initial.hasDraft) {
  const cleared = await request("/api/admin/homepage-draft", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: initial.revision }) });
  assert.equal(cleared.status, 200, "existing draft discarded");
  state = await draft();
}

const stamp = Date.now().toString(36);
const headlines = [`History ${stamp} one`, `History ${stamp} two`];
const created = [];
for (const headline of headlines) {
  const layout = { ...state.layout, content: { ...state.layout.content, heroHeadlineTop: headline } };
  const revision = await save(layout, state.revision);
  const published = await publish({ ...layout, expectedRevision: revision }, revision);
  assert.equal(published.layout.content.heroHeadlineTop, headline);
  const before = state.history.length;
  state = await draft();
  assert.equal(state.history.length, Math.min(10, before + 1), "publishing adds one version");
  assert.ok(state.history[0].savedAt >= (state.history[1]?.savedAt ?? ""), "newest version is first");
  created.push(state.history[0].id);
}

assert.equal(state.layout.content.heroHeadlineTop, headlines[1]);
const restoreTarget = created[1];
const load = await request("/api/admin/homepage-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load-version", versionId: restoreTarget, expectedRevision: state.revision }) });
assert.equal(load.status, 200, "older version loads into the draft");
const loaded = await load.json();
assert.equal(loaded.layout.content.heroHeadlineTop, headlines[0], "loaded version carries its own content");
assert.ok(loaded.layout.baseStructure, "loaded version is prepared for publishing against the current homepage");

const publishedAgain = await publish(loaded.layout, loaded.revision);
assert.equal(publishedAgain.layout.content.heroHeadlineTop, headlines[0], "restored version publishes");
state = await draft();
assert.equal(state.layout.content.heroHeadlineTop, headlines[0]);

const stale = await request("/api/admin/homepage-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load-version", versionId: restoreTarget, expectedRevision: "00000000-0000-4000-8000-000000000000" }) });
assert.equal(stale.status, 409, "stale version loads are rejected");

const unknown = await request("/api/admin/homepage-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "load-version", versionId: "11111111-1111-4111-8111-111111111111", expectedRevision: state.revision }) });
assert.equal(unknown.status, 409, "unknown versions are rejected");

// Filling the list keeps only the newest entries.
for (let index = 0; index < 11; index += 1) {
  const layout = { ...state.layout, content: { ...state.layout.content, heroHeadlineTop: `History ${stamp} fill ${index}` } };
  const revision = await save(layout, state.revision);
  await publish({ ...layout, expectedRevision: revision }, revision);
  state = await draft();
}
assert.equal(state.history.length, 10, "history keeps the ten newest versions");
const timestamps = state.history.map(entry => Date.parse(entry.savedAt));
assert.deepEqual(timestamps, [...timestamps].sort((a, b) => b - a), "newest version first");

await request("/api/admin/logout", { method: "POST" });
console.log("PASS homepage history records published versions, loads one into the draft, and keeps ten");
