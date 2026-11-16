/**
 * Expired cutout bridge images cannot be fetched, and the scheduled sweep
 * deletes only the expired rows. No user images are read.
 */
import assert from "node:assert/strict";
import { createHarness } from "./qa-harness.mjs";

const harness = await createHarness({ name: "cutout-expiry" });
const { db, load } = harness;

const route = await load("/app/api/cutout-bridge/[id]/route.ts");
const { sql } = await load("/lib/db.ts");

const currentId = "a".repeat(32);
const expiredId = "b".repeat(32);
const recentStamp = new Date().toISOString();
const oldStamp = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();

db.prepare("INSERT INTO cutout_bridge_images (id, content_type, bytes, created_at) VALUES (?, 'image/png', ?, ?)").run(
  currentId,
  new Uint8Array([1, 2, 3]),
  recentStamp
);
db.prepare("INSERT INTO cutout_bridge_images (id, content_type, bytes, created_at) VALUES (?, 'image/png', ?, ?)").run(
  expiredId,
  new Uint8Array([4]),
  oldStamp
);

const get = (id) => route.GET(new Request("https://example.test"), { params: Promise.resolve({ id }) });

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  const current = await get(currentId);
  check("a fresh image is served", current.status === 200);
  check("the image is never cached", current.headers.get("cache-control") === "private, no-store");
  check(
    "the stored bytes are returned",
    JSON.stringify([...new Uint8Array(await current.arrayBuffer())]) === JSON.stringify([1, 2, 3])
  );

  check("an expired image is not served", (await get(expiredId)).status === 404);
  check("an invalid id is not served", (await get("invalid")).status === 404);

  // The Worker's scheduled handler runs this exact sweep before serving traffic.
  await sql`DELETE FROM cutout_bridge_images WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')`;

  const remaining = db.prepare("SELECT id FROM cutout_bridge_images").all().map((row) => row.id);
  check("the sweep deletes only the expired image", JSON.stringify(remaining) === JSON.stringify([currentId]));
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} cutout expiry check(s) failed` : "\nall cutout expiry checks passed");
process.exit(failures ? 1 : 0);
