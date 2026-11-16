/** Exercise the real draft route against an isolated temporary PostgreSQL table. */
import { readFileSync } from "node:fs";
import Module from "node:module";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import ts from "typescript";
import { isDeepStrictEqual } from "node:util";

const require = createRequire(import.meta.url);
const builderSource = readFileSync(new URL("../lib/homepage-builder.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../app/api/admin/homepage-draft/route.ts", import.meta.url), "utf8");
function compile(source, mocks) {
  const mod = new Module("homepage-qa");
  mod.filename = fileURLToPath(new URL("../package.json", import.meta.url));
  mod.paths = Module._nodeModulePaths(process.cwd());
  mod.require = name => name in mocks ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, mod.filename);
  return mod.exports;
}
const builder = compile(builderSource, {});
const defaults = { heroLabel: "PRINT ON DEMAND STUDIO", heroHeadlineTop: "YOUR IDEAS.", heroHeadlineBottom: "MADE TO WEAR.", heroDescription: "Custom apparel", heroImage1: "/img/shop-studio.png", heroImage2: "/img/shop-printing.png", heroImage3: "/img/kingdom-team.webp", homeProductsTitle: "MAKE IT YOURS", homeProductsDescription: "Design your own", homeContactTitle: "READY TO ORDER?", homeContactDescription: "Contact us" };
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
const check = (label, ok) => { console.log(`${ok ? "PASS" : "FAIL"} ${label}`); if (!ok) throw new Error(label); };
try {
  await sql.begin(async tx => {
    await tx`CREATE TEMP TABLE site_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz DEFAULT now()) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE catalog_media (id text PRIMARY KEY) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE products (id integer PRIMARY KEY, active boolean NOT NULL) ON COMMIT DROP`;
    await tx`INSERT INTO products (id, active) VALUES (101, true), (102, false)`;
    const draftKey = "homepage_layout_draft_v1", revisionKey = "homepage_layout_draft_revision_v1", publishedKey = "homepage_layout_published_v1", previousKey = "homepage_layout_previous_v1";
    const read = async key => { const rows = await tx`SELECT key, value FROM site_settings`; const row = rows.find(item => item.key === key); return row ? builder.parseHomepageLayout(row.value) : null; };
    const db = Object.assign((...args) => Reflect.apply(tx, undefined, args), { begin: async callback => callback(tx) });
    let invalidations = 0;
    const route = compile(routeSource, {
      "next/server": { NextResponse: { json: (value, init) => Response.json(value, init) } },
      "next/cache": { revalidatePath: () => { invalidations++; } },
      "../_guard": { requireAdmin: async () => null },
      "@/lib/db": { sql: db },
      "@/lib/limited-form-data": { limitedJson: request => request.json() },
      "@/lib/homepage-builder": builder,
      "@/lib/catalog": { DEFAULT_SETTINGS: defaults, getSettings: async () => defaults },
      "@/lib/homepage-layout-store": { HOMEPAGE_DRAFT_KEY: draftKey, HOMEPAGE_DRAFT_REVISION_KEY: revisionKey, HOMEPAGE_PUBLISHED_KEY: publishedKey, HOMEPAGE_PREVIOUS_KEY: previousKey, readHomepageLayout: read, publishedHomepageLayout: async () => await read(publishedKey) ?? builder.defaultHomepageLayout() },
    });
    let revision = null;
    for (const method of ["PUT", "POST", "DELETE"]) {
      const handler = route[method];
      route[method] = async request => { const response = await handler(request); if (response.ok) { const data = await response.clone().json(); revision = method === "DELETE" ? null : data.revision; } return response; };
    }
    const request = (method, value) => new Request("http://localhost/api/admin/homepage-draft", { method, ...(method !== "GET" ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: revision, ...value }) } : {}) });
    const original = { ...builder.defaultHomepageLayout(), content: { ...defaults }, baseContent: { ...defaults }, baseStructure: builder.homepageStructure(builder.defaultHomepageLayout()) };
    const customId = "custom-11111111-1111-4111-8111-111111111111";
    const changed = { ...original, sections: [...original.sections].reverse().concat(customId), content: { ...defaults, heroLabel: "Custom test heading" }, designBanner: { ...builder.DEFAULT_DESIGN_BANNER, heading: "New heading", buttonLink: "/shop" }, customBlocks: [{ id: customId, type: "message", heading: "Our services", description: "Talk to us about your order", buttonText: "Contact us", buttonLink: "/contact" }] };
    check("initial draft reflects current homepage", JSON.stringify((await (await route.GET(request("GET"))).json()).layout) === JSON.stringify(original));
    check("invalid draft is rejected", (await route.PUT(request("PUT", { ...original, sections: ["hero"] }))).status === 422);
    check("hero cannot be hidden", (await route.PUT(request("PUT", { ...original, hiddenSections: ["hero"] }))).status === 422);
    check("unknown hidden section is rejected", (await route.PUT(request("PUT", { ...original, hiddenSections: ["unknown"] }))).status === 422);
    check("unsafe banner links are rejected", (await route.PUT(request("PUT", { ...changed, designBanner: { ...changed.designBanner, buttonLink: "//example.com" } }))).status === 422);
    check("unsafe section links are rejected", (await route.PUT(request("PUT", { ...changed, customBlocks: [{ ...changed.customBlocks[0], buttonLink: "javascript:alert(1)" }] }))).status === 422);
    check("unsafe hero button links are rejected", (await route.PUT(request("PUT", { ...changed, heroActions: { ...builder.DEFAULT_HERO_ACTIONS, primaryLink: "//example.com" } }))).status === 422);
    changed.heroActions = { ...builder.DEFAULT_HERO_ACTIONS, primaryText: "Browse the shop", primaryLink: "/shop?kind=tee" };
    const emptyHeroAction = { ...changed, heroActions: { ...changed.heroActions, primaryText: "" } };
    check("incomplete hero button can be saved", (await route.PUT(request("PUT", emptyHeroAction))).ok);
    check("incomplete hero button cannot be published", (await route.POST(request("POST", { action: "publish", layout: emptyHeroAction }))).status === 422);
    const blankHero = { ...changed, content: { ...changed.content, heroHeadlineTop: "" } };
    check("blank hero heading can be saved as a draft", (await route.PUT(request("PUT", blankHero))).ok);
    check("blank hero heading cannot be published", (await route.POST(request("POST", { action: "publish", layout: blankHero }))).status === 422);
    const blankProductsHeading = { ...changed, content: { ...changed.content, homeProductsTitle: "  " } };
    check("blank products heading can be saved as a draft", (await route.PUT(request("PUT", blankProductsHeading))).ok);
    check("blank products heading cannot be published", (await route.POST(request("POST", { action: "publish", layout: blankProductsHeading }))).status === 422);
    changed.questionsContent = { ...builder.DEFAULT_HOMEPAGE_QUESTIONS, items: builder.DEFAULT_HOMEPAGE_QUESTIONS.items.map(item => ({ ...item })) };
    check("unsafe questions link is rejected", (await route.PUT(request("PUT", { ...changed, questionsContent: { ...changed.questionsContent, items: [{ ...changed.questionsContent.items[0], linkText: "Open", link: "//example.com" }] } }))).status === 422);
    const emptyExistingAnswer = { ...changed, questionsContent: { ...changed.questionsContent, items: [{ ...changed.questionsContent.items[0], answer: "" }] } };
    check("incomplete existing question can be saved", (await route.PUT(request("PUT", emptyExistingAnswer))).ok);
    check("incomplete existing question cannot be published", (await route.POST(request("POST", { action: "publish", layout: emptyExistingAnswer }))).status === 422);
    check("invalid section styles are rejected", (await route.PUT(request("PUT", { ...changed, customBlocks: [{ ...changed.customBlocks[0], style: { tone: "url(evil)", alignment: "left", imagePosition: "right" } }] }))).status === 422);
    changed.customBlocks[0].style = { tone: "dark", alignment: "center", imagePosition: "left" };
    const emptyBlock = { ...changed, customBlocks: [{ ...changed.customBlocks[0], heading: "" }] };
    check("incomplete section can be saved as a draft", (await route.PUT(request("PUT", emptyBlock))).ok);
    check("incomplete section cannot be published", (await route.POST(request("POST", { action: "publish", layout: emptyBlock }))).status === 422);
    const faqId = "custom-33333333-3333-4333-8333-333333333333";
    const faq = { id: faqId, type: "faq", heading: "Questions", description: "", buttonText: "", buttonLink: "", faqItems: [{ question: "Help?", answer: "Contact us." }] };
    const faqDraft = { ...changed, sections: [...changed.sections, faqId], customBlocks: [...changed.customBlocks, faq] };
    const incompleteFaq = { ...faqDraft, customBlocks: [changed.customBlocks[0], { ...faq, faqItems: [{ question: "Help?", answer: "" }] }] };
    check("incomplete questions can be saved", (await route.PUT(request("PUT", incompleteFaq))).ok);
    check("incomplete questions cannot be published", (await route.POST(request("POST", { action: "publish", layout: incompleteFaq }))).status === 422);
    changed.sections.push(faqId); changed.customBlocks.push(faq);
    const productsId = "custom-44444444-4444-4444-8444-444444444444";
    const productBlock = { id: productsId, type: "products", heading: "Shop favorites", description: "", buttonText: "", buttonLink: "", productIds: [101] };
    const productDraft = { ...changed, sections: [...changed.sections, productsId], customBlocks: [...changed.customBlocks, productBlock] };
    const inactiveDraft = { ...productDraft, customBlocks: [...changed.customBlocks, { ...productBlock, productIds: [102] }] };
    check("inactive product selection can be saved as draft", (await route.PUT(request("PUT", inactiveDraft))).ok);
    check("inactive product cannot be published", (await route.POST(request("POST", { action: "publish", layout: inactiveDraft }))).status === 422);
    changed.sections.push(productsId); changed.customBlocks.push(productBlock);
    const sectionImage = { ...changed, customBlocks: [{ ...changed.customBlocks[0], image: "/api/product-media/22222222-2222-4222-8222-222222222222", imageAlt: "Example" }, faq, productBlock] };
    check("section image can be saved in draft", (await route.PUT(request("PUT", sectionImage))).ok);
    check("missing section image blocks publication", (await route.POST(request("POST", { action: "publish", layout: sectionImage }))).status === 422);
    await tx`INSERT INTO catalog_media (id) VALUES ('22222222-2222-4222-8222-222222222222')`;
    changed.customBlocks[0] = sectionImage.customBlocks[0];
    check("save draft", (await route.PUT(request("PUT", changed))).ok);
    const loadedDraft = await (await route.GET(request("GET"))).json();
    check("loading a saved draft returns its revision", loadedDraft.revision === revision && loadedDraft.hasDraft === true);
    const staleRevision = revision;
    check("another session saves a newer draft", (await route.PUT(request("PUT", changed))).ok);
    check("stale draft save is rejected", (await route.PUT(request("PUT", { ...changed, expectedRevision: staleRevision }))).status === 409);
    check("stale draft discard is rejected", (await route.DELETE(request("DELETE", { expectedRevision: staleRevision }))).status === 409);
    check("stale restore is rejected", (await route.POST(request("POST", { action: "restore", expectedRevision: staleRevision }))).status === 409);
    check("draft does not publish", !(await read(publishedKey)));
    check("stale publish is rejected", (await route.POST(request("POST", { action: "publish", layout: original }))).status === 409);
    await tx`INSERT INTO site_settings (key, value) VALUES (${publishedKey}, ${tx.json({ ...builder.defaultHomepageLayout(), sections: [...builder.defaultHomepageLayout().sections].reverse() })})`;
    check("a conflicting published layout is not overwritten", (await route.POST(request("POST", { action: "publish", layout: changed }))).status === 409);
    await tx`DELETE FROM site_settings WHERE key = ${publishedKey}`;
    await tx`INSERT INTO site_settings (key, value) VALUES ('hero_label', ${tx.json("Changed elsewhere")})`;
    check("conflicting live content is not overwritten", (await route.POST(request("POST", { action: "publish", layout: changed }))).status === 409);
    await tx`DELETE FROM site_settings WHERE key = 'hero_label'`;
    check("untrusted image URLs rejected", (await route.PUT(request("PUT", { ...changed, content: { ...changed.content, heroImage1: "https://example.com/unsafe.png" } }))).status === 422);
    const missingImage = { ...changed, content: { ...changed.content, heroImage1: "/api/product-media/11111111-1111-4111-8111-111111111111" } };
    check("save draft with uploaded image", (await route.PUT(request("PUT", missingImage))).ok);
    check("missing uploaded image cannot be published", (await route.POST(request("POST", { action: "publish", layout: missingImage }))).status === 422);
    check("replace image draft", (await route.PUT(request("PUT", changed))).ok);
    const publish = await route.POST(request("POST", { action: "publish", layout: changed }));
    if (!publish.ok) console.log("Publish response:", publish.status, await publish.clone().text());
    const actualPublished = await read(publishedKey);
    check("publish saved draft", publish.ok && isDeepStrictEqual(actualPublished, { ...changed, baseContent: changed.content, baseStructure: builder.homepageStructure(builder.parseHomepageLayout(changed)) }));
    check("publish updates homepage content", (await tx`SELECT value FROM site_settings WHERE key = 'hero_label'`)[0].value === "Custom test heading");
    const { baseStructure: _baseStructure, ...originalSnapshot } = original;
    check("previous layout retained", isDeepStrictEqual(await read(previousKey), originalSnapshot));
    check("restore previous layout", (await route.POST(request("POST", { action: "restore" }))).ok && isDeepStrictEqual(await read(publishedKey), original));
    check("restore replaces homepage content", (await tx`SELECT value FROM site_settings WHERE key = 'hero_label'`)[0].value === defaults.heroLabel);
    check("restored layout becomes draft", isDeepStrictEqual(await read(draftKey), original));
    check("publish and restore invalidate storefront cache", invalidations === 2);
    check("discard removes only the draft", (await route.DELETE(request("DELETE"))).ok && !(await read(draftKey)) && Boolean(await read(publishedKey)));
  });
} finally { await sql.end(); }
