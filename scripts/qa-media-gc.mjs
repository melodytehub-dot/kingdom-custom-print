/**
 * Product photo cleanup: photos the database still points at are never deleted,
 * unused ones are removed only after the grace period, and the run stops when
 * it looks like the reference scan missed something. Also checks that the
 * Worker only runs the sweep once a day.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createHarness } from "./qa-harness.mjs";

const harness = await createHarness({ name: "media-gc" });
const { db, load, run } = harness;

const { sweepOrphanProductMedia, referencedProductMedia } = await load("/lib/media-storage.ts");

const day = 24 * 3600 * 1000;
const now = Date.UTC(2026, 10, 17, 3, 0, 0);
const old = new Date(now - 30 * day);
const fresh = new Date(now - 1 * day);

const id = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

/** Minimal in-memory stand-in for the R2 binding. */
function fakeBucket(entries) {
  const objects = new Map(entries.map(({ key, uploaded }) => [key, { key, uploaded }]));
  return {
    objects,
    async put() {},
    async get() {
      return null;
    },
    async head(key) {
      return objects.has(key) ? {} : null;
    },
    async delete(key) {
      objects.delete(key);
    },
    async list({ prefix = "" } = {}) {
      const keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      return { objects: keys.map((key) => ({ key, uploaded: objects.get(key).uploaded })), truncated: false };
    },
  };
}

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

/** Loads worker.ts with the media and database layers stubbed out. */
function loadWorker(calls) {
  const source = fs.readFileSync("worker.ts", "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const deps = {
    "vinext/server/fetch-handler": { default: { fetch: async () => new Response(null) } },
    "./lib/db-context": { runWithDatabaseContext: (_context, fn) => fn(), closeDatabaseContext: async () => {} },
    "./lib/media-storage": {
      sweepExpiredCutout: async () => {
        calls.cutout += 1;
      },
      sweepOrphanProductMedia: async () => {
        calls.photos += 1;
        return { scanned: 0, referenced: 0, deleted: [], kept: [] };
      },
    },
  };
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (!deps[name]) throw new Error(`Missing mock: ${name}`);
      return deps[name];
    },
    URL,
    Headers,
    Response,
    Request,
    console,
    globalThis: {},
  });
  return exports.default;
}

try {
  // One photo in each place the app stores a URL, plus three unused ones.
  const onColor = id(1);
  const onGallery = id(2);
  const onHomepage = id(3);
  const unusedOld = id(4);
  const unusedFresh = id(5);
  const unusedUnknownAge = id(6);

  run("UPDATE product_colors SET front_image = ? WHERE id = (SELECT MIN(id) FROM product_colors)", `/api/product-media/${onColor}`);
  run("INSERT INTO product_images (product_id, url, alt, sort_order) VALUES ((SELECT MIN(id) FROM products), ?, '__color_gallery__:white', 0)", `/api/product-media/${onGallery}`);
  run("INSERT INTO site_settings (key, value) VALUES ('homepage_content_v1', ?)", JSON.stringify({ heroImage1: `/api/product-media/${onHomepage}` }));

  const bucket = fakeBucket([
    { key: `product/${onColor}`, uploaded: old },
    { key: `product/${onGallery}`, uploaded: old },
    { key: `product/${onHomepage}`, uploaded: old },
    { key: `product/${unusedOld}`, uploaded: old },
    { key: `product/${unusedFresh}`, uploaded: fresh },
    { key: `product/${unusedUnknownAge}`, uploaded: undefined },
    { key: `cutout/${"c".repeat(32)}`, uploaded: old },
  ]);
  globalThis.__kcpMediaBucket = bucket;

  const referenced = await referencedProductMedia();
  check("front images are treated as references", referenced.has(onColor));
  check("gallery rows are treated as references", referenced.has(onGallery));
  check("homepage settings are treated as references", referenced.has(onHomepage));

  const report = await sweepOrphanProductMedia(now);
  const remaining = [...bucket.objects.keys()].sort();

  check("the sweep only looks at product photos", report.scanned === 6);
  check("an old unused photo is deleted", !remaining.includes(`product/${unusedOld}`));
  check("a photo used by a colour survives", remaining.includes(`product/${onColor}`));
  check("a photo used by the gallery survives", remaining.includes(`product/${onGallery}`));
  check("a photo used by the homepage survives", remaining.includes(`product/${onHomepage}`));
  check("a recent upload survives the grace period", remaining.includes(`product/${unusedFresh}`));
  check("a photo with no upload time is kept", remaining.includes(`product/${unusedUnknownAge}`));
  check("cutout images are outside this sweep", remaining.includes(`cutout/${"c".repeat(32)}`));
  check("the report lists what it deleted", JSON.stringify(report.deleted) === JSON.stringify([`product/${unusedOld}`]));

  // A reference scan that suddenly finds nothing must not clear the bucket.
  const backlog = [];
  for (let n = 10; n < 10 + 30; n += 1) backlog.push({ key: `product/${id(n)}`, uploaded: old });
  const crowded = fakeBucket(backlog);
  globalThis.__kcpMediaBucket = crowded;
  const guarded = await sweepOrphanProductMedia(now);
  check("a suspiciously large backlog deletes nothing", guarded.deleted.length === 0);
  check("the guarded run reports what it kept", guarded.kept.length === 30);
  check("the bucket is untouched when the guard trips", crowded.objects.size === 30);

  // Without R2 (local development) the sweep is a no-op rather than an error.
  globalThis.__kcpMediaBucket = undefined;
  const local = await sweepOrphanProductMedia(now);
  check("the sweep does nothing without a bucket", local.scanned === 0 && local.deleted.length === 0);

  // The Worker's hourly schedule sweeps cutouts every hour and photos once a day.
  const calls = { cutout: 0, photos: 0 };
  const worker = loadWorker(calls);
  const env = { DB: {}, MEDIA: undefined };
  await worker.scheduled({ scheduledTime: Date.UTC(2026, 10, 17, 9, 0, 0) }, env);
  check("an off-hour run sweeps only cutouts", calls.cutout === 1 && calls.photos === 0);
  await worker.scheduled({ scheduledTime: Date.UTC(2026, 10, 17, 3, 0, 0) }, env);
  check("the daily run also sweeps product photos", calls.cutout === 2 && calls.photos === 1);
  await worker.scheduled({}, env);
  check("a run without a scheduled time skips the photo sweep", calls.photos === 1);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

assert.ok(true);
console.log(failures ? `\n${failures} media sweep check(s) failed` : "\nall media sweep checks passed");
process.exit(failures ? 1 : 0);
