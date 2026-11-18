/**
 * Page builder: the layout schema rejects anything unsafe, responsive styles
 * compile to container queries, and drafts/publishing honour revisions.
 */
import { createHarness } from "./qa-harness.mjs";

const harness = await createHarness({ name: "page-builder" });
const { load } = harness;

const schema = await load("/lib/builder/schema.ts");
const tree = await load("/lib/builder/tree.ts");
const styles = await load("/lib/builder/styles.ts");
const store = await load("/lib/builder/store.ts");

let failures = 0;
const check = (label, condition, detail = "") => {
  console.log(`${condition ? "PASS" : "FAIL"} ${label}${condition || !detail ? "" : ` — ${detail}`}`);
  if (!condition) failures += 1;
};

const heading = () => ({ ...schema.newWidget("heading"), text: "Made to order" });
const text = () => ({ ...schema.newWidget("text"), text: "Two lines\nof copy" });

function sampleLayout() {
  const layout = schema.newLayout();
  layout.sections[0].columns[0].widgets.push(heading(), text());
  return layout;
}

try {
  /* ---------------------------------------------------------------- schema */

  const layout = sampleLayout();
  const parsed = schema.parseBuilderLayout(JSON.parse(JSON.stringify(layout)));
  check("a layout round-trips through storage", JSON.stringify(parsed) === JSON.stringify(layout));

  check("plain text keeps its line breaks", parsed.sections[0].columns[0].widgets[1].text.includes("\n"));

  const reject = (label, mutate) => {
    const copy = JSON.parse(JSON.stringify(layout));
    mutate(copy);
    check(label, schema.parseBuilderLayout(copy) === null);
  };

  reject("a script link is rejected", (copy) => {
    copy.sections[0].columns[0].widgets.push({ ...schema.newWidget("button"), href: "javascript:alert(1)" });
  });
  reject("an external http link is rejected", (copy) => {
    copy.sections[0].columns[0].widgets.push({ ...schema.newWidget("button"), href: "http://example.com" });
  });
  reject("a path-traversal image is rejected", (copy) => {
    copy.sections[0].columns[0].widgets.push({ ...schema.newWidget("image"), src: "/img/../../etc/passwd" });
  });
  reject("a non-hex colour is rejected", (copy) => {
    copy.sections[0].style.desktop.backgroundColor = "red; background:url(x)";
  });
  reject("an out-of-range font size is rejected", (copy) => {
    copy.sections[0].columns[0].widgets[0].style.desktop.fontSize = 400;
  });
  reject("an unknown widget kind is rejected", (copy) => {
    copy.sections[0].columns[0].widgets.push({ id: "not-a-uuid", kind: "iframe" });
  });
  reject("two elements cannot share an id", (copy) => {
    copy.sections[0].columns[0].widgets[1].id = copy.sections[0].columns[0].widgets[0].id;
  });
  reject("a section needs a column", (copy) => {
    copy.sections[0].columns = [];
  });
  reject("too many columns are rejected", (copy) => {
    for (let index = 0; index < 5; index += 1) copy.sections[0].columns.push(schema.newColumn());
  });

  const page = schema.parseBuilderPage({
    slug: "made-to-order",
    title: "Made to order",
    description: "",
    showTitle: true,
    layout,
    updatedAt: new Date().toISOString(),
  });
  check("a complete page parses", page !== null);
  check("a reserved address is not available", schema.isBuilderSlug("shop") === false);
  check("a normal address is available", schema.isBuilderSlug("made-to-order") === true);
  check("an empty title is rejected", schema.parseBuilderPage({
    slug: "made-to-order",
    title: "   ",
    description: "",
    layout,
    updatedAt: new Date().toISOString(),
  }) === null);

  check("http links are allowed only with https", schema.isSafeBuilderLink("https://example.com/page"));
  check("anchors are allowed", schema.isSafeBuilderLink("#faq"));
  check("relative links are allowed", schema.isSafeBuilderLink("/contact"));

  const rich = schema.newLayout();
  rich.sections[0].backgroundImage = "/img/shop-printing.png";
  rich.sections[0].backgroundOverlay = 45;
  rich.sections[0].columns[0].widgets.push(
    schema.newWidget("promo-banner"),
    schema.newWidget("product-grid"),
    schema.newWidget("category-strip"),
    schema.newWidget("feature-cards"),
    schema.newWidget("image-gallery"),
    schema.newWidget("contact-block"),
    { ...schema.newWidget("image"), src: "/brand/logo.png", alt: "Logo" }
  );
  const parsedRich = schema.parseBuilderLayout(JSON.parse(JSON.stringify(rich)));
  check("all 6 storefront widgets, section backgrounds, and /brand images round-trip", JSON.stringify(parsedRich) === JSON.stringify(rich));

  reject("a script promo button link is rejected", (copy) => {
    copy.sections[0].columns[0].widgets.push({ ...schema.newWidget("promo-banner"), ctaHref: "javascript:alert(1)" });
  });
  reject("an insecure category-strip http link is rejected", (copy) => {
    const strip = schema.newWidget("category-strip");
    strip.items[0].href = "http://example.com";
    copy.sections[0].columns[0].widgets.push(strip);
  });
  reject("a path-traversal gallery image is rejected", (copy) => {
    const gallery = schema.newWidget("image-gallery");
    gallery.items[0].src = "/brand/../secret.png";
    copy.sections[0].columns[0].widgets.push(gallery);
  });
  reject("an external section background image is rejected", (copy) => {
    copy.sections[0].backgroundImage = "https://evil.example/x.png";
  });

  check("built-in editable storefront slugs are allowed", schema.isBuilderSlug("about") === true && schema.isBuilderSlug("faq") === true);
  check("non-editable system routes stay blocked", schema.isBuilderSlug("shop") === false && schema.isBuilderSlug("admin") === false);
  check("an empty layout reports no content", schema.layoutHasContent(schema.newLayout()) === false);
  check("a populated layout reports content", schema.layoutHasContent(layout) === true);

  /* ------------------------------------------------------------------ tree */

  const columnId = layout.sections[0].columns[0].id;
  const withImage = tree.insertWidget(layout, columnId, schema.newWidget("image"));
  check("a widget is added to a column", tree.findNode(withImage, columnId).widgets.length === 3);
  check("adding a widget keeps the original layout intact", layout.sections[0].columns[0].widgets.length === 2);

  const duplicated = tree.duplicateNode(layout, layout.sections[0].columns[0].widgets[0].id);
  const copies = duplicated.sections[0].columns[0].widgets;
  check("duplicating a block inserts a copy", copies.length === 3);
  check("the copy gets its own id", copies[0].id !== copies[1].id);

  const secondColumn = schema.newColumn();
  const twoColumns = tree.insertColumn(layout, layout.sections[0].id, secondColumn);
  check("a second column splits the row", twoColumns.sections[0].columns.every((column) => column.style.desktop.columnWidth === 50));

  const moved = tree.moveWidget(layout, layout.sections[0].columns[0].widgets[1].id, columnId, 0);
  check("a block can move to the top of its column", moved.sections[0].columns[0].widgets[0].text.includes("\n"));

  const twoSections = tree.insertSection(layout, schema.newSection());
  const firstSecId = twoSections.sections[0].id;
  const secondSecId = twoSections.sections[1].id;
  const swappedSections = tree.moveSection(twoSections, secondSecId, 0);
  check("moveSection reorders sections", swappedSections.sections[0].id === secondSecId && swappedSections.sections[1].id === firstSecId);

  const threeCols = tree.setSectionColumnsPreset(layout, layout.sections[0].id, [33, 33, 34]);
  const trailingWidget = schema.newWidget("divider");
  const withTrailingWidget = tree.insertWidget(threeCols, threeCols.sections[0].columns[2].id, trailingWidget);
  const shrunk = tree.setSectionColumnsPreset(withTrailingWidget, withTrailingWidget.sections[0].id, [50, 50]);
  check(
    "shrinking columns preserves trailing widgets",
    shrunk.sections[0].columns.length === 2 &&
      shrunk.sections[0].columns[1].widgets.some((w) => w.id === trailingWidget.id)
  );

  const resizedCols = tree.resizeColumns(twoColumns, twoColumns.sections[0].id, 0, 35, "desktop");
  check(
    "resizeColumns updates adjacent column widths cleanly",
    resizedCols.sections[0].columns[0].style.desktop.columnWidth === 35 &&
      resizedCols.sections[0].columns[1].style.desktop.columnWidth === 65
  );
  const clampedCols = tree.resizeColumns(twoColumns, twoColumns.sections[0].id, 0, 5, "desktop");
  check(
    "resizeColumns clamps column widths to [15, 85]",
    clampedCols.sections[0].columns[0].style.desktop.columnWidth === 15 &&
      clampedCols.sections[0].columns[1].style.desktop.columnWidth === 85
  );

  const removedSection = tree.removeNode(layout, layout.sections[0].id);
  check("removing a section empties the page", removedSection.sections.length === 0);

  /* ---------------------------------------------------------------- styles */

  const responsive = JSON.parse(JSON.stringify(layout));
  responsive.sections[0].style.desktop.paddingTop = 80;
  responsive.sections[0].style.desktop.minHeight = 320;
  responsive.sections[0].style.desktop.boxShadow = "md";
  responsive.sections[0].style.desktop.fontFamily = "display";
  responsive.sections[0].style.desktop.textTransform = "uppercase";
  responsive.sections[0].columns[0].widgets[0].style.desktop.fontSize = 48;
  responsive.sections[0].columns[0].widgets[0].style.tablet = { fontSize: 36 };
  responsive.sections[0].columns[0].widgets[0].style.mobile = { fontSize: 28, textAlign: "center" };

  const node = responsive.sections[0].columns[0].widgets[0];
  check("tablet inherits unset desktop values", styles.effectiveStyle(node, "tablet").fontSize === 36);
  check("mobile falls back through tablet", styles.effectiveStyle(node, "mobile").fontSize === 28);
  check("desktop ignores narrow overrides", styles.effectiveStyle(node, "desktop").fontSize === 48);
  check("an override is reported only on its own screen", styles.isOverridden(node, "mobile", "fontSize"));
  check("a property nobody set is not an override", !styles.isOverridden(node, "mobile", "letterSpacing"));

  const css = styles.builderStylesheet(responsive);
  check("the stylesheet carries desktop rules", css.includes(".kcp-b-") && css.includes("font-size:48px"));
  check("expanded styles compile into the stylesheet", css.includes("min-height:320px") && css.includes("box-shadow:") && css.includes("text-transform:uppercase"));
  check("tablet rules use a container query", css.includes("@container kcp-page (max-width:1024px)"));
  check("mobile rules use the narrow container", css.includes("@container kcp-page (max-width:640px)"));
  check("mobile rules come last so they win", css.lastIndexOf("max-width:640px") > css.lastIndexOf("max-width:1024px"));
  check("columns stack on phones by default", css.includes("flex:0 0 100%;max-width:100%"));
  check("the stylesheet never emits a script or url()", !/url\(|javascript:|expression\(/i.test(css));

  /* ----------------------------------------------------------------- store */

  const directAbout = await store.publishBuilderPage({
    slug: "about",
    title: "About us",
    description: "",
    showTitle: false,
    layout,
    expectedRevision: 0,
  });
  check("publishing a built-in page directly at rev 0 creates rev 1", directAbout.ok && directAbout.revision === 1);
  check("the directly published built-in page is served", (await store.readPublishedBuilderPage("about")) !== null);
  await store.deleteBuilderPage("about");

  const input = {
    slug: "made-to-order",
    title: "Made to order",
    description: "How we build each order.",
    showTitle: true,
    layout,
    expectedRevision: 0,
  };

  const created = await store.saveBuilderDraft(input);
  check("a new page is created at revision 1", created.ok && created.revision === 1);

  const saved = await store.saveBuilderDraft({ ...input, expectedRevision: 1, title: "Made to order" });
  check("saving a draft bumps the revision", saved.ok && saved.revision === 2);

  const stale = await store.saveBuilderDraft({ ...input, expectedRevision: 1 });
  check("a stale revision is refused", !stale.ok && stale.reason === "conflict");

  const duplicate = await store.saveBuilderDraft({ ...input, expectedRevision: 0 });
  check("the same address cannot be created twice", !duplicate.ok && duplicate.reason === "conflict");

  const published = await store.publishBuilderPage({ ...input, expectedRevision: 2 });
  check("publishing bumps the revision", published.ok && published.revision === 3);

  const live = await store.readPublishedBuilderPage("made-to-order");
  check("the published page is served", live !== null && live.title === "Made to order");
  check("the published layout keeps its blocks", live?.layout.sections[0].columns[0].widgets.length === 2);

  const draft = await store.readBuilderDraft("made-to-order");
  check("the draft is marked published", draft?.published === true && draft?.revision === 3);

  const hidden = await store.unpublishBuilderPage("made-to-order", 3);
  check("unpublishing bumps the revision", hidden.ok && hidden.revision === 4);
  check("an unpublished page is not public", (await store.readPublishedBuilderPage("made-to-order")) === null);
  check("the draft survives unpublishing", (await store.readBuilderDraft("made-to-order"))?.page.title === "Made to order");

  const listed = await store.listBuilderPages();
  check("the page appears in the list", listed.length === 1 && listed[0].slug === "made-to-order");

  check("deleting removes the page", (await store.deleteBuilderPage("made-to-order")) === true);
  check("a deleted page is gone", (await store.readBuilderDraft("made-to-order")) === null);
} catch (error) {
  failures += 1;
  console.log(`FAIL ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
} finally {
  await harness.close();
}

console.log(failures ? `\n${failures} page builder check(s) failed` : "\nall page builder checks passed");
process.exit(failures ? 1 : 0);
