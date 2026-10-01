import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });

// Blank apparel spec is catalogue data the client can edit in the dashboard.
// No ratings, review counts or stock claims are seeded — those would be fabricated.
const categories = [
  { slug: "t-shirts", name: "T-Shirts", description: "Short and long sleeve blanks for everyday custom prints.", sort: 1 },
  { slug: "sweatshirts", name: "Sweatshirts", description: "Hoodies and crewnecks with a large printable surface.", sort: 2 },
  { slug: "headwear", name: "Caps & Beanies", description: "Structured caps with a flat front panel for embroidery or print.", sort: 3 },
  { slug: "drinkware", name: "Drinkware", description: "Ceramic mugs for logos and artwork.", sort: 4 },
];

const products = [
  {
    slug: "crown-classic-tee",
    name: "Crown Classic Tee",
    category: "t-shirts",
    kind: "tee",
    material: "100% ringspun cotton, 220 gsm",
    blurb: "Heavyweight cotton with a structured collar that holds its shape after washing.",
    description:
      "A dependable blank for chest marks and full front prints. The 220 gsm ringspun cotton is dense enough that artwork reads cleanly without a backing sheet, and the shoulder-to-shoulder taping keeps the collar flat through repeated wash cycles. Side-seamed construction allows printing on the front, back, left chest, or both sides.",
    base_price: 24,
    compare_at: null,
    print_fee: 6,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: true,
    sort: 1,
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "white", name: "White", hex: "#F4F2ED" },
      { slug: "sand", name: "Sand", hex: "#D6C7AE" },
      { slug: "forest", name: "Forest", hex: "#25392F" },
      { slug: "oxblood", name: "Oxblood", hex: "#5A1A22" },
    ],
    sizes: [
      { label: "S", surcharge: 0 },
      { label: "M", surcharge: 0 },
      { label: "L", surcharge: 0 },
      { label: "XL", surcharge: 0 },
      { label: "2XL", surcharge: 3 },
      { label: "3XL", surcharge: 5 },
    ],
    breaks: [
      { min_qty: 1, off: 0 },
      { min_qty: 6, off: -1 },
      { min_qty: 12, off: -2 },
      { min_qty: 24, off: -3 },
      { min_qty: 50, off: -5 },
    ],
  },
  {
    slug: "studio-long-sleeve",
    name: "Studio Long Sleeve",
    category: "t-shirts",
    kind: "longsleeve",
    material: "100% combed cotton, 180 gsm",
    blurb: "Combed cotton with a smooth surface suited to detailed sleeve and back prints.",
    description:
      "Built for designs that need room. The combed cotton finish removes loose fibres, which keeps fine linework sharp under ink. Long sleeves open up printing options that a short sleeve cannot take — full sleeves, cuffs, or a large back panel.",
    base_price: 32,
    compare_at: null,
    print_fee: 7,
    print_area: { frontW: 0.4, frontH: 0.46, backW: 0.6, backH: 0.62 },
    featured: false,
    sort: 2,
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "white", name: "White", hex: "#F4F2ED" },
      { slug: "heather", name: "Heather Grey", hex: "#B4B4B6" },
      { slug: "forest", name: "Forest", hex: "#25392F" },
    ],
    sizes: [
      { label: "S", surcharge: 0 },
      { label: "M", surcharge: 0 },
      { label: "L", surcharge: 0 },
      { label: "XL", surcharge: 0 },
      { label: "2XL", surcharge: 3 },
    ],
    breaks: [
      { min_qty: 1, off: 0 },
      { min_qty: 6, off: -1 },
      { min_qty: 12, off: -2 },
      { min_qty: 24, off: -3 },
    ],
  },
  {
    slug: "legacy-graphic-tee",
    name: "Legacy Graphic Tee",
    category: "t-shirts",
    kind: "tee",
    material: "Ring-spun cotton, 190 gsm, garment dyed",
    description:
      "Garment dyed for a softer hand and a slightly worn-in look straight off the press. The lighter knit takes large back prints well without the print sitting stiff on the surface.",
    base_price: 28,
    compare_at: 34,
    print_fee: 6,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: false,
    sort: 3,
    blurb: "Garment dyed for a softer hand and a worn-in look.",
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "cream", name: "Cream", hex: "#E8DFCE" },
      { slug: "clay", name: "Clay", hex: "#9C5B3E" },
      { slug: "navy", name: "Navy", hex: "#26314C" },
    ],
    sizes: [
      { label: "S", surcharge: 0 },
      { label: "M", surcharge: 0 },
      { label: "L", surcharge: 0 },
      { label: "XL", surcharge: 0 },
      { label: "2XL", surcharge: 3 },
    ],
    breaks: [
      { min_qty: 1, off: 0 },
      { min_qty: 6, off: -1 },
      { min_qty: 12, off: -2 },
      { min_qty: 24, off: -3 },
    ],
  },
  {
    slug: "minimalist-hoodie",
    name: "Minimalist Hoodie",
    category: "sweatshirts",
    kind: "hoodie",
    material: "Brushed-back fleece, 350 gsm",
    blurb: "Brushed-back fleece with a double-lined hood and a wide back panel for artwork.",
    description:
      "The heaviest blank in the range. A 350 gsm brushed-back fleece gives a large front or back print a flat surface to sit on. The double-lined hood holds its shape, and ribbed cuffs and hem keep the sleeves in place during wear.",
    base_price: 52,
    compare_at: 62,
    print_fee: 9,
    print_area: { frontW: 0.46, frontH: 0.44, backW: 0.6, backH: 0.6 },
    featured: true,
    sort: 4,
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "charcoal", name: "Charcoal", hex: "#3A3A3C" },
      { slug: "oat", name: "Oat", hex: "#DCD2C0" },
      { slug: "forest", name: "Forest", hex: "#25392F" },
    ],
    sizes: [
      { label: "S", surcharge: 0 },
      { label: "M", surcharge: 0 },
      { label: "L", surcharge: 0 },
      { label: "XL", surcharge: 0 },
      { label: "2XL", surcharge: 4 },
    ],
    breaks: [
      { min_qty: 1, off: 0 },
      { min_qty: 6, off: -2 },
      { min_qty: 12, off: -4 },
      { min_qty: 24, off: -6 },
    ],
  },
  {
    slug: "essential-crew",
    name: "Essential Crewneck",
    category: "sweatshirts",
    kind: "crew",
    material: "Midweight fleece, 300 gsm",
    blurb: "A clean crewneck surface for left chest marks and mid-weight front prints.",
    description:
      "Midweight fleece sits between a tee and a hoodie. The flat front panel takes a left chest mark or a medium front print without the bulk of a full hoodie.",
    base_price: 46,
    compare_at: null,
    print_fee: 8,
    print_area: { frontW: 0.44, frontH: 0.44, backW: 0.6, backH: 0.6 },
    featured: true,
    sort: 5,
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "oat", name: "Oat", hex: "#DCD2C0" },
      { slug: "navy", name: "Navy", hex: "#26314C" },
      { slug: "wine", name: "Wine", hex: "#5C1F2C" },
    ],
    sizes: [
      { label: "S", surcharge: 0 },
      { label: "M", surcharge: 0 },
      { label: "L", surcharge: 0 },
      { label: "XL", surcharge: 0 },
      { label: "2XL", surcharge: 3 },
    ],
    breaks: [
      { min_qty: 1, off: 0 },
      { min_qty: 6, off: -2 },
      { min_qty: 12, off: -3 },
      { min_qty: 24, off: -5 },
    ],
  },
  {
    slug: "urban-snapback",
    name: "Urban Snapback",
    category: "headwear",
    kind: "cap",
    material: "Structured six-panel, flat brim",
    blurb: "Structured six-panel with a flat printable front panel.",
    description:
      "A flat front panel takes a logo cleanly at small sizes. Structured front, flat brim, snap closure.",
    base_price: 26,
    compare_at: null,
    print_fee: 7,
    print_area: { frontW: 0.52, frontH: 0.42, backW: 0.52, backH: 0.42 },
    featured: true,
    sort: 6,
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "olive", name: "Olive", hex: "#4A4A33" },
      { slug: "stone", name: "Stone", hex: "#C8C2B4" },
    ],
    sizes: [{ label: "One Size", surcharge: 0 }],
    breaks: [
      { min_qty: 1, off: 0 },
      { min_qty: 12, off: -2 },
      { min_qty: 24, off: -3 },
      { min_qty: 50, off: -5 },
    ],
  },
  {
    slug: "kingdom-mug",
    name: "Kingdom Mug 11oz",
    category: "drinkware",
    kind: "mug",
    material: "Ceramic, 11oz",
    blurb: "Ceramic mug with a printable face for logos and artwork.",
    description:
      "Standard 11oz ceramic mug. Full wrap available on request for logos that run edge to edge.",
    base_price: 16,
    compare_at: null,
    print_fee: 5,
    print_area: { frontW: 0.66, frontH: 0.56, backW: 0.66, backH: 0.56 },
    featured: false,
    sort: 7,
    colors: [
      { slug: "white", name: "White", hex: "#F4F2ED" },
      { slug: "black", name: "Black", hex: "#141414" },
    ],
    sizes: [{ label: "11oz", surcharge: 0 }],
    breaks: [
      { min_qty: 1, off: 0 },
      { min_qty: 6, off: -1 },
      { min_qty: 12, off: -2 },
      { min_qty: 24, off: -3 },
    ],
  },
];

const settings = {
  announcement: {
    value: "Free US shipping on orders over $75",
  },
  shipping_flat: { value: 6.95 },
  free_shipping_threshold: { value: 75 },
  contact_email: { value: "" },
  contact_phone: { value: "" },
  business_address: { value: "" },
  production_days: { value: "3-5 business days after artwork approval" },
};

async function main() {
  const existing = await sql`SELECT count(*)::int AS n FROM products`;
  if (existing[0].n > 0 && !process.argv.includes("--force")) {
    console.log(
      `Catalog already seeded (${existing[0].n} products). Re-run with --force to reseed.`
    );
    return;
  }

  await sql.begin(async (tx) => {
    await tx`TRUNCATE order_items, orders, customers, product_images, price_breaks,
      product_sizes, product_colors, products, categories RESTART IDENTITY CASCADE`;

    const catIds = new Map();
    for (const c of categories) {
      const [row] = await tx`
        INSERT INTO categories (slug, name, description, sort_order)
        VALUES (${c.slug}, ${c.name}, ${c.description}, ${c.sort})
        RETURNING id`;
      catIds.set(c.slug, row.id);
    }

    for (const p of products) {
      const [prod] = await tx`
        INSERT INTO products (slug, name, category_id, kind, blurb, description, material,
          base_price, compare_at, print_fee_per_side, print_area, featured, active, sort_order)
        VALUES (${p.slug}, ${p.name}, ${catIds.get(p.category)}, ${p.kind}, ${p.blurb},
          ${p.description}, ${p.material}, ${p.base_price}, ${p.compare_at}, ${p.print_fee},
          ${tx.json(p.print_area)}, ${p.featured}, true, ${p.sort})
        RETURNING id`;

      for (const [i, c] of p.colors.entries()) {
        await tx`
          INSERT INTO product_colors (product_id, slug, name, hex, sort_order)
          VALUES (${prod.id}, ${c.slug}, ${c.name}, ${c.hex}, ${i})`;
      }
      for (const [i, s] of p.sizes.entries()) {
        await tx`
          INSERT INTO product_sizes (product_id, label, surcharge, sort_order)
          VALUES (${prod.id}, ${s.label}, ${s.surcharge}, ${i})`;
      }
      for (const b of p.breaks) {
        await tx`
          INSERT INTO price_breaks (product_id, min_qty, amount_off)
          VALUES (${prod.id}, ${b.min_qty}, ${b.off})`;
      }
    }

    for (const [key, s] of Object.entries(settings)) {
      await tx`
        INSERT INTO site_settings (key, value) VALUES (${key}, ${tx.json(s.value)})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    }
  });

  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
  console.log("Contact details are intentionally blank — set them in the admin dashboard.");
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error("Seed failed:", err.message);
    await sql.end();
    process.exit(1);
  });