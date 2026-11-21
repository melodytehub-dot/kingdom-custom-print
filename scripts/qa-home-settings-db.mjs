/**
 * Storefront copy lives in `site_settings` as JSON text. Saving one section must
 * keep the other settings, and a stale homepage edit must not overwrite a newer
 * one.
 */
import assert from "node:assert/strict";
import { createHarness } from "./qa-harness.mjs";

const harness = await createHarness({ name: "home-settings" });
const { db, load } = harness;
const catalog = await load("/lib/catalog.ts");
const builder = await load("/lib/homepage-builder.ts");
const auth = await load("/lib/admin-auth.ts");
const settingsRoute = await load("/app/api/admin/settings/route.ts");
process.env.ADMIN_PASSWORD = "local-dashboard-test-password";

const read = () =>
  new Map(
    db
      .prepare("SELECT key, value FROM site_settings")
      .all()
      .map((row) => [row.key, catalog.parseSettingValue(row.value)])
  );

let failures = 0;
const check = (label, condition) => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  if (!condition) failures += 1;
};

try {
  const original = await catalog.getSettings();
  check("the seeded storefront uses the default homepage copy", original.homeProductsTitle === "MAKE IT YOURS");

  const saved = {
    ...original,
    homeProductsTitle: "Your team",
    homeProductsDescription: "Choose a style",
    homeContactTitle: "Questions?",
    homeContactDescription: "Get in touch.",
  };
  await catalog.saveSettings(saved);
  const stored = read();
  check("the products heading is saved", stored.get("home_products_title") === "Your team");
  check("the products description is saved", stored.get("home_products_description") === "Choose a style");
  check("the contact heading is saved", stored.get("home_contact_title") === "Questions?");
  check("the contact description is saved", stored.get("home_contact_description") === "Get in touch.");
  check("saving homepage copy leaves the announcement alone", stored.get("announcement") === original.announcement);

  await catalog.saveSettings({ ...saved, announcementLink: "/contact", footerBlurb: "Made by our team.", announcement: "Free shipping" });
  const headerFooter = read();
  check("the announcement link is saved", headerFooter.get("announcement_link") === "/contact");
  check("the footer blurb is saved", headerFooter.get("footer_blurb") === "Made by our team.");
  check("the announcement is saved", headerFooter.get("announcement") === "Free shipping");

  const baseline = builder.homepageContentFromSettings(saved);
  await catalog.saveSettings({ ...saved, homeContactTitle: "New title" }, baseline);
  check("a fresh homepage edit saves", read().get("home_contact_title") === "New title");

  let staleRejected = false;
  try {
    await catalog.saveSettings(saved, baseline);
  } catch (error) {
    staleRejected = error instanceof catalog.HomepageContentConflict;
  }
  check("a stale homepage edit is refused", staleRejected);
  check("the newer copy is kept", read().get("home_contact_title") === "New title");

  const reread = await catalog.getSettings();
  check("settings read back through the storefront loader", reread.homeProductsTitle === "Your team");
  check("numeric settings survive the round trip", reread.shippingFlat === original.shippingFlat);

  const logoId = "11111111-1111-4111-8111-111111111111";
  const slideId = "22222222-2222-4222-8222-222222222222";
  for (const id of [logoId, slideId]) db.prepare("INSERT INTO catalog_media (id, content_type, content) VALUES (?, ?, ?)").run(id, "image/png", new Uint8Array([137, 80, 78, 71]));
  const token = await auth.createSession();
  const put = (body) => settingsRoute.PUT(new Request("http://localhost:3000/api/admin/settings", { method: "PUT", headers: { origin: "http://localhost:3000", cookie: `kcp_admin=${token}`, "content-type": "application/json" }, body: JSON.stringify(body) }));
  const valid = await put({ siteLogo: `/api/product-media/${logoId}`, heroImage1: `/api/product-media/${slideId}` });
  check("logo and slideshow images save through the admin endpoint", valid.status === 200);
  const withBranding = await catalog.getSettings();
  check("the storefront settings load the saved logo and slide", withBranding.siteLogo.endsWith(logoId) && withBranding.heroImage1.endsWith(slideId));
  const missing = await put({ siteLogo: "/api/product-media/33333333-3333-4333-8333-333333333333" });
  check("a missing logo is rejected without replacing the saved logo", missing.status === 422 && (await catalog.getSettings()).siteLogo === withBranding.siteLogo);
  const unsafe = await put({ siteLogo: "https://example.com/logo.png" });
  check("external logo URLs are rejected", unsafe.status === 422);
  const missingSlide = await put({ heroImage2: "/api/product-media/33333333-3333-4333-8333-333333333333" });
  check("a missing slideshow image is rejected", missingSlide.status === 422);
  const reset = await put({ siteLogo: "/brand/kingdom-logo.png" });
  check("the original logo can be restored", reset.status === 200 && (await catalog.getSettings()).siteLogo === original.siteLogo);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} home settings check(s) failed` : "\nall home settings checks passed");
process.exit(failures ? 1 : 0);
