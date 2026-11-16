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
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} home settings check(s) failed` : "\nall home settings checks passed");
process.exit(failures ? 1 : 0);
