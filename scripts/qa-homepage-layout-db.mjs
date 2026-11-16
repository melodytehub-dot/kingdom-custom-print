/**
 * Drives the real homepage draft route: validation, revision conflicts,
 * publishing, history and restore, against a disposable seeded database.
 */
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { createHarness } from "./qa-harness.mjs";

process.env.ADMIN_PASSWORD ??= "localtestpassword123";
const harness = await createHarness({ name: "homepage-layout" });
const { db, load } = harness;

const builder = await load("/lib/homepage-builder.ts");
const store = await load("/lib/homepage-layout-store.ts");
const catalog = await load("/lib/catalog.ts");
const auth = await load("/lib/admin-auth.ts");
const route = await load("/app/api/admin/homepage-draft/route.ts");

const token = await auth.createSession();
let revision = null;
let invalidations = 0;

const call = async (method, value = {}) => {
  const response = await route[method](
    new Request("http://localhost/api/admin/homepage-draft", {
      method,
      headers: { cookie: `kcp_admin=${token}`, origin: "http://localhost", "content-type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify({ expectedRevision: revision, ...value }) }),
    })
  );
  if (response.ok) {
    const data = method === "GET" ? null : await response.clone().json().catch(() => null);
    if (method === "DELETE") revision = null;
    else if (method === "PUT" || method === "POST") revision = data?.revision ?? revision;
  }
  return response;
};

const blank = builder.defaultHomepageLayout();
const original = (await (await call("GET")).json()).layout;
const defaults = catalog.DEFAULT_SETTINGS;
const welcome = original.content ?? builder.homepageContentFromSettings(defaults);

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failures += 1;
};

try {
  // Products referenced by a products section.
  const activeProduct = db.prepare("SELECT id FROM products WHERE active = 1 ORDER BY id LIMIT 1").get().id;
  const inactiveProduct = db
    .prepare("SELECT id FROM products WHERE active = 1 AND id <> ? ORDER BY id LIMIT 1")
    .get(activeProduct).id;
  db.prepare("UPDATE products SET active = 0 WHERE id = ?").run(inactiveProduct);

  const customId = "custom-11111111-1111-4111-8111-111111111111";
  const changed = {
    ...original,
    sections: [...original.sections].reverse().concat(customId),
    content: { ...welcome, heroLabel: "Custom test heading" },
    designBanner: { ...builder.DEFAULT_DESIGN_BANNER, heading: "New heading", buttonLink: "/shop" },
    customBlocks: [
      {
        id: customId,
        type: "message",
        heading: "Our services",
        description: "Talk to us about your order",
        buttonText: "Contact us",
        buttonLink: "/contact",
      },
    ],
  };

  check("the initial draft reflects the live homepage", isDeepStrictEqual((await (await call("GET")).json()).layout, original));
  check("an invalid section list is rejected", (await call("PUT", { ...original, sections: ["hero"] })).status === 422);
  check("the hero cannot be hidden", (await call("PUT", { ...original, hiddenSections: ["hero"] })).status === 422);
  check("an unknown hidden section is rejected", (await call("PUT", { ...original, hiddenSections: ["unknown"] })).status === 422);
  check(
    "an unsafe banner link is rejected",
    (await call("PUT", { ...changed, designBanner: { ...changed.designBanner, buttonLink: "//example.com" } })).status === 422
  );
  check(
    "an unsafe section link is rejected",
    (await call("PUT", { ...changed, customBlocks: [{ ...changed.customBlocks[0], buttonLink: "javascript:alert(1)" }] })).status === 422
  );
  check(
    "an unsafe hero button link is rejected",
    (await call("PUT", { ...changed, heroActions: { ...builder.DEFAULT_HERO_ACTIONS, primaryLink: "//example.com" } })).status === 422
  );

  changed.heroActions = { ...builder.DEFAULT_HERO_ACTIONS, primaryText: "Browse the shop", primaryLink: "/shop?kind=tee" };
  const emptyHeroAction = { ...changed, heroActions: { ...changed.heroActions, primaryText: "" } };
  check("an incomplete hero button can be saved", (await call("PUT", emptyHeroAction)).ok);
  check(
    "an incomplete hero button cannot be published",
    (await call("POST", { action: "publish", layout: emptyHeroAction })).status === 422
  );

  const blankHero = { ...changed, content: { ...changed.content, heroHeadlineTop: "" } };
  check("a blank hero heading can be saved as a draft", (await call("PUT", blankHero)).ok);
  check("a blank hero heading cannot be published", (await call("POST", { action: "publish", layout: blankHero })).status === 422);

  const blankProductsHeading = { ...changed, content: { ...changed.content, homeProductsTitle: "  " } };
  check("a blank products heading can be saved as a draft", (await call("PUT", blankProductsHeading)).ok);
  check(
    "a blank products heading cannot be published",
    (await call("POST", { action: "publish", layout: blankProductsHeading })).status === 422
  );

  changed.questionsContent = {
    ...builder.DEFAULT_HOMEPAGE_QUESTIONS,
    items: builder.DEFAULT_HOMEPAGE_QUESTIONS.items.map((item) => ({ ...item })),
  };
  check(
    "an unsafe questions link is rejected",
    (
      await call("PUT", {
        ...changed,
        questionsContent: {
          ...changed.questionsContent,
          items: [{ ...changed.questionsContent.items[0], linkText: "Open", link: "//example.com" }],
        },
      })
    ).status === 422
  );
  const emptyExistingAnswer = {
    ...changed,
    questionsContent: { ...changed.questionsContent, items: [{ ...changed.questionsContent.items[0], answer: "" }] },
  };
  check("an incomplete existing question can be saved", (await call("PUT", emptyExistingAnswer)).ok);
  check(
    "an incomplete existing question cannot be published",
    (await call("POST", { action: "publish", layout: emptyExistingAnswer })).status === 422
  );

  check(
    "invalid section styles are rejected",
    (
      await call("PUT", {
        ...changed,
        customBlocks: [
          { ...changed.customBlocks[0], style: { tone: "url(evil)", alignment: "left", imagePosition: "right" } },
        ],
      })
    ).status === 422
  );
  changed.customBlocks[0].style = { tone: "dark", alignment: "center", imagePosition: "left" };
  const emptyBlock = { ...changed, customBlocks: [{ ...changed.customBlocks[0], heading: "" }] };
  check("an incomplete section can be saved as a draft", (await call("PUT", emptyBlock)).ok);
  check("an incomplete section cannot be published", (await call("POST", { action: "publish", layout: emptyBlock })).status === 422);

  const faqId = "custom-33333333-3333-4333-8333-333333333333";
  const faq = {
    id: faqId,
    type: "faq",
    heading: "Questions",
    description: "",
    buttonText: "",
    buttonLink: "",
    faqItems: [{ question: "Help?", answer: "Contact us." }],
  };
  const faqDraft = { ...changed, sections: [...changed.sections, faqId], customBlocks: [...changed.customBlocks, faq] };
  const incompleteFaq = {
    ...faqDraft,
    customBlocks: [changed.customBlocks[0], { ...faq, faqItems: [{ question: "Help?", answer: "" }] }],
  };
  check("incomplete questions can be saved", (await call("PUT", incompleteFaq)).ok);
  check("incomplete questions cannot be published", (await call("POST", { action: "publish", layout: incompleteFaq })).status === 422);

  changed.sections.push(faqId);
  changed.customBlocks.push(faq);
  const productsId = "custom-44444444-4444-4444-8444-444444444444";
  const productBlock = {
    id: productsId,
    type: "products",
    heading: "Shop favorites",
    description: "",
    buttonText: "",
    buttonLink: "",
    productIds: [activeProduct],
  };
  const productDraft = { ...changed, sections: [...changed.sections, productsId], customBlocks: [...changed.customBlocks, productBlock] };
  const inactiveDraft = {
    ...productDraft,
    customBlocks: [...changed.customBlocks, { ...productBlock, productIds: [inactiveProduct] }],
  };
  check("an inactive product selection can be saved as a draft", (await call("PUT", inactiveDraft)).ok);
  check(
    "an inactive product cannot be published",
    (await call("POST", { action: "publish", layout: inactiveDraft })).status === 422
  );

  changed.sections.push(productsId);
  changed.customBlocks.push(productBlock);
  const sectionImage = {
    ...changed,
    customBlocks: [
      { ...changed.customBlocks[0], image: "/api/product-media/22222222-2222-4222-8222-222222222222", imageAlt: "Example" },
      faq,
      productBlock,
    ],
  };
  check("a section image can be saved in a draft", (await call("PUT", sectionImage)).ok);
  check(
    "a missing section image blocks publication",
    (await call("POST", { action: "publish", layout: sectionImage })).status === 422
  );

  db.prepare("INSERT INTO catalog_media (id, content_type, content) VALUES (?, 'image/png', ?)").run(
    "22222222-2222-4222-8222-222222222222",
    new Uint8Array([1])
  );
  changed.customBlocks[0] = sectionImage.customBlocks[0];
  check("the corrected draft saves", (await call("PUT", changed)).ok);

  const loadedDraft = await (await call("GET")).json();
  check("loading a saved draft returns its revision", loadedDraft.revision === revision && loadedDraft.hasDraft === true);

  const staleRevision = revision;
  check("another session saves a newer draft", (await call("PUT", changed)).ok);
  check("a stale draft save is rejected", (await call("PUT", { ...changed, expectedRevision: staleRevision })).status === 409);
  check("a stale discard is rejected", (await call("DELETE", { expectedRevision: staleRevision })).status === 409);
  check("a stale restore is rejected", (await call("POST", { action: "restore", expectedRevision: staleRevision })).status === 409);
  check("saving a draft does not publish it", !(await store.readHomepageLayout(store.HOMEPAGE_PUBLISHED_KEY)));

  check("a stale publish is rejected", (await call("POST", { action: "publish", layout: original })).status === 409);

  db.prepare("INSERT INTO site_settings (key, value) VALUES (?, ?)").run(
    store.HOMEPAGE_PUBLISHED_KEY,
    JSON.stringify({ ...blank, sections: [...blank.sections].reverse() })
  );
  check(
    "a conflicting published layout is not overwritten",
    (await call("POST", { action: "publish", layout: changed })).status === 409
  );
  db.prepare("DELETE FROM site_settings WHERE key = ?").run(store.HOMEPAGE_PUBLISHED_KEY);

  db.prepare("INSERT INTO site_settings (key, value) VALUES ('hero_label', ?)").run(JSON.stringify("Changed elsewhere"));
  check(
    "conflicting live content is not overwritten",
    (await call("POST", { action: "publish", layout: changed })).status === 409
  );
  db.prepare("DELETE FROM site_settings WHERE key = 'hero_label'").run();

  check(
    "untrusted image URLs are rejected",
    (await call("PUT", { ...changed, content: { ...changed.content, heroImage1: "https://example.com/unsafe.png" } })).status === 422
  );
  const missingImage = {
    ...changed,
    content: { ...changed.content, heroImage1: "/api/product-media/11111111-1111-4111-8111-111111111111" },
  };
  check("a draft with an uploaded image saves", (await call("PUT", missingImage)).ok);
  check(
    "a missing uploaded image cannot be published",
    (await call("POST", { action: "publish", layout: missingImage })).status === 422
  );
  check("replacing the image draft saves", (await call("PUT", changed)).ok);

  const publish = await call("POST", { action: "publish", layout: changed });
  if (!publish.ok) console.log("Publish response:", publish.status, await publish.clone().text());
  const actualPublished = await store.readHomepageLayout(store.HOMEPAGE_PUBLISHED_KEY);
  check(
    "publishing saves the draft",
    publish.ok &&
      isDeepStrictEqual(actualPublished, {
        ...changed,
        baseContent: changed.content,
        baseStructure: builder.homepageStructure(builder.parseHomepageLayout(changed)),
      })
  );
  check(
    "publishing updates the homepage copy",
    catalog.parseSettingValue(db.prepare("SELECT value FROM site_settings WHERE key = 'hero_label'").get().value) ===
      "Custom test heading"
  );

  const { baseStructure: _baseStructure, ...originalSnapshot } = original;
  check(
    "the previous layout is retained",
    isDeepStrictEqual(await store.readHomepageLayout(store.HOMEPAGE_PREVIOUS_KEY), originalSnapshot)
  );
  const restore = await call("POST", { action: "restore" });
  check(
    "the previous layout can be restored",
    restore.ok && isDeepStrictEqual(await store.readHomepageLayout(store.HOMEPAGE_PUBLISHED_KEY), original)
  );
  check(
    "restoring replaces the homepage copy",
    catalog.parseSettingValue(db.prepare("SELECT value FROM site_settings WHERE key = 'hero_label'").get().value) ===
      defaults.heroLabel
  );
  check("the restored layout becomes the draft", isDeepStrictEqual(await store.readHomepageLayout(store.HOMEPAGE_DRAFT_KEY), original));

  check("discard removes only the draft", (await call("DELETE")).ok && !(await store.readHomepageLayout(store.HOMEPAGE_DRAFT_KEY)) && Boolean(await store.readHomepageLayout(store.HOMEPAGE_PUBLISHED_KEY)));
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} homepage layout check(s) failed` : "\nall homepage layout checks passed");
process.exit(failures ? 1 : 0);
