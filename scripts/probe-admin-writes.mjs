/**
 * Drives the admin write paths over HTTP against the local dev server.
 * Start the server with ADMIN_PASSWORD=localtestpassword123 on port 3026 first.
 */
const base = process.env.QA_BASE ?? "http://localhost:3026";
const password = process.env.ADMIN_PASSWORD ?? "localtestpassword123";

let failures = 0;
const check = (label, condition, extra = "") => {
  console.log(`${condition ? "ok  " : "FAIL"} ${label}${condition || !extra ? "" : ` (${extra})`}`);
  if (!condition) failures += 1;
};

const login = await fetch(`${base}/api/admin/login`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ password }),
});
check("admin signs in", login.status === 200, `status ${login.status}`);
const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

const call = async (path, init = {}) => {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie, origin: base, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  return { status: response.status, body };
};

// Settings round-trip.
const settings = await call("/api/admin/settings");
check("reads settings", settings.status === 200 && typeof settings.body.heroHeadlineTop === "string");
const updated = await call("/api/admin/settings", {
  method: "PUT",
  body: JSON.stringify({ ...settings.body, announcement: "QA announcement" }),
});
check("saves settings", updated.status === 200, JSON.stringify(updated.body));
const reread = await call("/api/admin/settings");
check("settings persist", reread.body.announcement === "QA announcement", reread.body.announcement);
check("numeric settings survive the JSON round-trip", reread.body.shippingFlat === settings.body.shippingFlat && reread.body.freeShippingThreshold === settings.body.freeShippingThreshold);

// Category and product create/update/delete.
const slug = `qa-probe-${Date.now()}`;
const category = await call("/api/admin/categories", {
  method: "POST",
  body: JSON.stringify({ name: "QA Probe", slug, description: "Temporary QA category.", sortOrder: 900 }),
});
check("creates a category", category.status === 200 || category.status === 201, JSON.stringify(category.body));
const categoryId = category.body?.id ?? category.body?.category?.id;

const productPayload = {
  name: "QA Probe Tee",
  slug: `${slug}-tee`,
  styleCode: "QA1000",
  categoryId: categoryId ?? null,
  kind: "tee",
  saleMode: "customizable",
  blurb: "Temporary product for validation.",
  description: "Temporary product for validation.",
  material: "100% cotton",
  basePrice: 12.5,
  compareAt: null,
  printFeePerSide: 3,
  printArea: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
  featured: false,
  active: true,
  colors: [{ slug: "black", name: "Black", hex: "#141414" }],
  sizes: [{ label: "M", surcharge: 0 }],
  priceBreaks: [{ minQty: 12, amountOff: 1.5 }],
};
const created = await call("/api/admin/products", { method: "POST", body: JSON.stringify(productPayload) });
check("creates a product with variants", created.status === 200 || created.status === 201, JSON.stringify(created.body));

const pageFor = async (path) => {
  const response = await fetch(`${base}${path}`);
  return { status: response.status, html: await response.text() };
};
const createdPage = await pageFor(`/product/${productPayload.slug}`);
check("new product renders on the storefront", createdPage.status === 200 && createdPage.html.includes("QA Probe Tee"), `status ${createdPage.status}`);
check("new product shows its size and colour", createdPage.html.includes("Black") && createdPage.html.includes(">M<"));

const productId = created.body?.id;
if (productId) {
  const edited = await call("/api/admin/products", {
    method: "PUT",
    body: JSON.stringify({ ...productPayload, id: productId, name: "QA Probe Tee Edited", printArea: { frontW: 0.5, frontH: 0.5, backW: 0.6, backH: 0.6 }, sizes: [{ label: "M", surcharge: 0 }, { label: "L", surcharge: 1 }] }),
  });
  check("updates a product and its variants", edited.status === 200, JSON.stringify(edited.body));
  const editedPage = await pageFor(`/product/${productPayload.slug}`);
  check("update persisted including new name and size", editedPage.html.includes("QA Probe Tee Edited") && editedPage.html.includes(">L<"));
  const removed = await call(`/api/admin/products?id=${productId}`, { method: "DELETE" });
  check("deletes the probe product", removed.status === 200, JSON.stringify(removed.body));
  const gonePage = await pageFor(`/product/${productPayload.slug}`);
  check("deleted product is no longer served", !gonePage.html.includes("QA Probe Tee Edited"));
}
if (categoryId) await call(`/api/admin/categories?id=${categoryId}`, { method: "DELETE" });

// Homepage draft: save, read, publish, discard.
const draft = await call("/api/admin/homepage-draft");
check("reads the homepage draft", draft.status === 200 && Array.isArray(draft.body.layout?.sections));
const layout = { ...draft.body.layout, content: { ...draft.body.layout.content, heroHeadlineTop: "QA HEADLINE." } };
const savedDraft = await call("/api/admin/homepage-draft", {
  method: "PUT",
  body: JSON.stringify({ ...layout, expectedRevision: draft.body.revision }),
});
check("saves the homepage draft", savedDraft.status === 200, JSON.stringify(savedDraft.body));
const staleDraft = await call("/api/admin/homepage-draft", {
  method: "PUT",
  body: JSON.stringify({ ...layout, expectedRevision: draft.body.revision }),
});
check("stale draft revision is refused", staleDraft.status === 409, `status ${staleDraft.status}`);
const rereadDraft = await call("/api/admin/homepage-draft");
check("draft persists with a new revision", rereadDraft.body.revision === savedDraft.body.revision && rereadDraft.body.hasDraft === true);

const published = await call("/api/admin/homepage-draft", {
  method: "POST",
  body: JSON.stringify({ action: "publish", layout, expectedRevision: savedDraft.body.revision }),
});
check("publishes the draft", published.status === 200, JSON.stringify(published.body).slice(0, 300));
// The homepage sets revalidate = 60, so give the route cache a moment to expire.
let html = "";
for (let attempt = 0; attempt < 14; attempt += 1) {
  html = await (await fetch(`${base}/`)).text();
  if (html.toLowerCase().includes("qa headline")) break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
check("published homepage renders the new headline", html.toLowerCase().includes("qa headline"));

const afterPublish = await call("/api/admin/homepage-draft");
const discard = await call("/api/admin/homepage-draft", {
  method: "DELETE",
  body: JSON.stringify({ expectedRevision: afterPublish.body.revision }),
});
check("discards the draft", discard.status === 200, JSON.stringify(discard.body));

console.log(failures ? `\n${failures} check(s) failed` : "\nall admin write checks passed");
process.exit(failures ? 1 : 0);

