import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with --env-file=.env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, ssl: "require" });

/* -------------------------------------------------------------------------
   Catalogue
   Blank specs and pricing are store data the client can edit in the
   dashboard. Nothing here is fabricated as social proof — no ratings,
   review counts or "sold" claims.
   ------------------------------------------------------------------------- */

const categories = [
  { slug: "t-shirts", name: "T-Shirts", description: "Short and long sleeve blanks for everyday custom prints.", sort: 1 },
  { slug: "sweatshirts", name: "Sweatshirts", description: "Hoodies and crewnecks with a large printable surface.", sort: 2 },
  { slug: "headwear", name: "Caps & Beanies", description: "Structured caps with a flat front panel for embroidery or print.", sort: 3 },
  { slug: "drinkware", name: "Drinkware", description: "Ceramic mugs for logos and artwork.", sort: 4 },
];

/* Reusable colour palettes ------------------------------------------------ */

const CLASSIC_COLORS = [
  { slug: "white", name: "White", hex: "#FFFFFF" },
  { slug: "black", name: "Black", hex: "#141414" },
  { slug: "ash", name: "Ash", hex: "#D8D8D8" },
  { slug: "sport-grey", name: "Sport Grey", hex: "#B4B4B6" },
  { slug: "navy", name: "Navy", hex: "#1F2A44" },
  { slug: "royal", name: "Royal", hex: "#1E4B9E" },
  { slug: "red", name: "Red", hex: "#C8102E" },
  { slug: "maroon", name: "Maroon", hex: "#5A1A22" },
  { slug: "forest", name: "Forest", hex: "#1F3D2B" },
  { slug: "kelly", name: "Kelly Green", hex: "#1E7A3C" },
  { slug: "gold", name: "Gold", hex: "#D9A11E" },
  { slug: "orange", name: "Orange", hex: "#D9621E" },
  { slug: "purple", name: "Purple", hex: "#4A2A6B" },
  { slug: "sand", name: "Sand", hex: "#D6C7AE" },
];

const EARTH_COLORS = [
  { slug: "ivory", name: "Ivory", hex: "#EFE9DA" },
  { slug: "butter", name: "Butter", hex: "#EBD9A0" },
  { slug: "mustard", name: "Mustard", hex: "#C8901F" },
  { slug: "terracotta", name: "Terracotta", hex: "#B65C42" },
  { slug: "crimson", name: "Crimson", hex: "#8C2A2A" },
  { slug: "sage", name: "Sage", hex: "#9CAF97" },
  { slug: "blue-spruce", name: "Blue Spruce", hex: "#2F4A52" },
  { slug: "blue-jean", name: "Blue Jean", hex: "#5B7C99" },
  { slug: "denim", name: "Denim", hex: "#3A4A63" },
  { slug: "pepper", name: "Pepper", hex: "#3B3B3B" },
];

const BLEND_COLORS = [
  { slug: "tri-black", name: "Tri-Black", hex: "#1B1B1B" },
  { slug: "tri-navy", name: "Tri-Navy", hex: "#232C3F" },
  { slug: "tri-grey", name: "Tri-Grey", hex: "#A9A9A9" },
  { slug: "tri-red", name: "Tri-Red", hex: "#A8312E" },
  { slug: "tri-blue", name: "Tri-Blue", hex: "#3E6D9C" },
  { slug: "tri-green", name: "Tri-Green", hex: "#3F6B4E" },
  { slug: "tri-cream", name: "Tri-Cream", hex: "#E7DFC9" },
  { slug: "tri-purple", name: "Tri-Purple", hex: "#5A4670" },
];

const PERFORMANCE_COLORS = [
  { slug: "white", name: "White", hex: "#FFFFFF" },
  { slug: "black", name: "Black", hex: "#141414" },
  { slug: "royal", name: "Royal", hex: "#1E4B9E" },
  { slug: "navy", name: "Navy", hex: "#1F2A44" },
  { slug: "red", name: "Red", hex: "#C8102E" },
  { slug: "sport-grey", name: "Sport Grey", hex: "#B4B4B6" },
  { slug: "orange", name: "Orange", hex: "#D9621E" },
  { slug: "kelly", name: "Kelly Green", hex: "#1E7A3C" },
];

const HEATHER_COLORS = [
  { slug: "white", name: "White", hex: "#FFFFFF" },
  { slug: "black", name: "Black", hex: "#141414" },
  { slug: "heather-grey", name: "Heather Grey", hex: "#B9BCC0" },
  { slug: "heather-navy", name: "Heather Navy", hex: "#3A4257" },
  { slug: "heather-red", name: "Heather Red", hex: "#9E4646" },
  { slug: "heather-blue", name: "Heather Blue", hex: "#5A7A9E" },
  { slug: "heather-purple", name: "Heather Purple", hex: "#6B5C82" },
  { slug: "sage", name: "Sage", hex: "#A6BBA0" },
];

/* Reusable size runs ------------------------------------------------------ */

const ADULT_SIZES = [
  { label: "S", surcharge: 0 },
  { label: "M", surcharge: 0 },
  { label: "L", surcharge: 0 },
  { label: "XL", surcharge: 0 },
  { label: "2XL", surcharge: 3 },
  { label: "3XL", surcharge: 5 },
  { label: "4XL", surcharge: 7 },
];

const ADULT_SIZES_XS = [{ label: "XS", surcharge: 0 }, ...ADULT_SIZES];

const WOMEN_SIZES = [
  { label: "S", surcharge: 0 },
  { label: "M", surcharge: 0 },
  { label: "L", surcharge: 0 },
  { label: "XL", surcharge: 0 },
  { label: "2XL", surcharge: 3 },
];

const YOUTH_SIZES = [
  { label: "YXS", surcharge: 0 },
  { label: "YS", surcharge: 0 },
  { label: "YM", surcharge: 0 },
  { label: "YL", surcharge: 0 },
  { label: "YXL", surcharge: 2 },
];

/* Quantity breaks: amount subtracted from the unit price as the run grows. */
const TEE_BREAKS = [
  { min_qty: 1, off: 0 },
  { min_qty: 6, off: -0.75 },
  { min_qty: 12, off: -1.5 },
  { min_qty: 24, off: -2.25 },
  { min_qty: 50, off: -3 },
  { min_qty: 100, off: -3.75 },
];

const PREMIUM_BREAKS = [
  { min_qty: 1, off: 0 },
  { min_qty: 6, off: -1 },
  { min_qty: 12, off: -1.75 },
  { min_qty: 24, off: -2.5 },
  { min_qty: 50, off: -3.5 },
  { min_qty: 100, off: -4.25 },
];

const FLEECE_BREAKS = [
  { min_qty: 1, off: 0 },
  { min_qty: 6, off: -2 },
  { min_qty: 12, off: -3 },
  { min_qty: 24, off: -4.5 },
  { min_qty: 50, off: -6 },
];

const ACCESSORY_BREAKS = [
  { min_qty: 1, off: 0 },
  { min_qty: 12, off: -1.5 },
  { min_qty: 24, off: -2.5 },
  { min_qty: 50, off: -3.5 },
];

const products = [
  /* ------------------------------- T-shirts ------------------------------ */
  {
    slug: "crown-classic-tee",
    name: "Crown Classic Tee",
    style: "RT2000",
    category: "t-shirts",
    kind: "tee",
    material: "100% cotton, 5.3 oz / 180 gsm, unisex fit",
    blurb: "The everyday unisex tee — soft midweight cotton that takes a full front or back print without stiffening.",
    description:
      "The blank we print most. A midweight 100% cotton body with shoulder-to-shoulder taping keeps the collar flat through repeated washes, and the side-seamed construction gives artwork a flat surface on the front, back, left chest or both sides. It holds a large back print without the ink sitting heavy on the surface.",
    base_price: 9.5,
    compare_at: null,
    print_fee: 4.5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: true,
    sort: 1,
    colors: CLASSIC_COLORS,
    sizes: ADULT_SIZES,
    breaks: TEE_BREAKS,
    images: [
      { url: "/img/products/crown-classic-tee-white.jpg", alt: "Crown Classic Tee in White" },
      { url: "/img/products/crown-classic-tee-black.jpg", alt: "Crown Classic Tee in Black" },
      { url: "/img/products/crown-classic-tee-red.jpg", alt: "Crown Classic Tee in Red" },
      { url: "/img/products/crown-classic-tee-maroon.jpg", alt: "Crown Classic Tee in Maroon" },
      { url: "/img/products/crown-classic-tee-ash.jpg", alt: "Crown Classic Tee in Ash" },
    ],
  },
  {
    slug: "heavy-cotton-tee",
    name: "Heavy Cotton Tee",
    style: "G500",
    category: "t-shirts",
    kind: "tee",
    material: "100% cotton, 5.3 oz / 180 gsm, heavyweight",
    blurb: "A denser cotton tee built for bold, high-coverage prints.",
    description:
      "Substantial cotton with a roomy cut and a dry hand. The heavier knit stands up to large, high-coverage prints and holds its shape over a long run, which makes it a favourite for team and event tees.",
    base_price: 9.0,
    compare_at: null,
    print_fee: 4.5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: true,
    sort: 2,
    colors: CLASSIC_COLORS,
    sizes: ADULT_SIZES,
    breaks: TEE_BREAKS,
    images: [{ url: "/img/products/heavy-cotton-tee.jpg", alt: "Heavy Cotton Tee" }],
  },
  {
    slug: "softstyle-tee",
    name: "Softstyle Tee",
    style: "G640",
    category: "t-shirts",
    kind: "tee",
    material: "100% ring-spun cotton, 4.5 oz / 153 gsm",
    blurb: "A lighter ring-spun tee with a smooth face that keeps fine detail sharp.",
    description:
      "Ring-spun cotton removes loose fibres, so fine linework and small text reproduce cleanly. The lighter weight makes it a natural choice for detail-heavy artwork and retail-style merch.",
    base_price: 10.0,
    compare_at: null,
    print_fee: 4.5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: true,
    sort: 3,
    colors: CLASSIC_COLORS,
    sizes: ADULT_SIZES_XS,
    breaks: TEE_BREAKS,
    images: [{ url: "/img/products/softstyle-tee.jpg", alt: "Softstyle Tee" }],
  },
  {
    slug: "ultra-cotton-tee",
    name: "Ultra Cotton Tee",
    style: "G200",
    category: "t-shirts",
    kind: "tee",
    material: "100% cotton, 6.0 oz / 203 gsm",
    blurb: "The classic workhorse blank: substantial cotton with a relaxed, roomy cut.",
    description:
      "A thick, sturdy cotton tee with plenty of room through the body. It takes heavy ink coverage well and is the blank we reach for when a print needs to feel substantial on the garment.",
    base_price: 9.75,
    compare_at: 11.5,
    print_fee: 4.5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: false,
    sort: 4,
    colors: CLASSIC_COLORS,
    sizes: ADULT_SIZES,
    breaks: TEE_BREAKS,
    images: [{ url: "/img/products/ultra-cotton-tee.jpg", alt: "Ultra Cotton Tee" }],
  },
  {
    slug: "comfort-colors-tee",
    name: "Comfort Colors Tee",
    style: "C1717",
    category: "t-shirts",
    kind: "tee",
    material: "100% garment-dyed cotton, 6.1 oz / 207 gsm",
    blurb: "Garment-dyed cotton with a lived-in colour and a soft, broken-in hand.",
    description:
      "Garment dyeing gives every piece a slightly faded, vintage tone and a soft hand straight out of the box. The muted palette prints beautifully with both light and dark ink, and the heavier body drapes well.",
    base_price: 13.5,
    compare_at: null,
    print_fee: 5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: true,
    sort: 5,
    colors: EARTH_COLORS,
    sizes: ADULT_SIZES,
    breaks: PREMIUM_BREAKS,
    images: [{ url: "/img/products/comfort-colors-tee.jpg", alt: "Comfort Colors Tee" }],
  },
  {
    slug: "tri-blend-tee",
    name: "Tri-Blend Tee",
    style: "3413C",
    category: "t-shirts",
    kind: "tee",
    material: "50% poly / 25% cotton / 25% rayon, 3.8 oz",
    blurb: "Cotton, polyester and rayon for an exceptionally soft, drapey tee.",
    description:
      "The softest blank in the range. The tri-blend knit has a subtle heathered look and a fluid drape that suits retail-style designs and smaller, centred prints.",
    base_price: 14.25,
    compare_at: null,
    print_fee: 5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: true,
    sort: 6,
    colors: BLEND_COLORS,
    sizes: ADULT_SIZES_XS,
    breaks: PREMIUM_BREAKS,
    images: [{ url: "/img/products/tri-blend-tee.jpg", alt: "Tri-Blend Tee" }],
  },
  {
    slug: "cvc-tee",
    name: "CVC Cotton Blend Tee",
    style: "N6210",
    category: "t-shirts",
    kind: "tee",
    material: "60% cotton / 40% polyester, 4.3 oz",
    blurb: "A cotton/poly blend that resists shrinking and holds colour wash after wash.",
    description:
      "The cotton/poly blend keeps its size and colour far better than a pure cotton tee, which makes it a strong pick for uniforms and repeated wear. Soft enough for retail, durable enough for a work crew.",
    base_price: 11.5,
    compare_at: null,
    print_fee: 4.5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: false,
    sort: 7,
    colors: PERFORMANCE_COLORS,
    sizes: ADULT_SIZES_XS,
    breaks: TEE_BREAKS,
    images: [{ url: "/img/products/cvc-tee.jpg", alt: "CVC Cotton Blend Tee" }],
  },
  {
    slug: "performance-tee",
    name: "Performance Tee",
    style: "N3142",
    category: "t-shirts",
    kind: "tee",
    material: "100% polyester, 3.8 oz, moisture-wicking",
    blurb: "Moisture-wicking polyester for team kits, gyms and outdoor events.",
    description:
      "A light, quick-drying performance knit that pulls moisture away from the body. Built for sports teams, gyms and outdoor events where a cotton tee would hold sweat.",
    base_price: 12.0,
    compare_at: null,
    print_fee: 4.5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: false,
    sort: 8,
    colors: PERFORMANCE_COLORS,
    sizes: ADULT_SIZES_XS,
    breaks: TEE_BREAKS,
    images: [{ url: "/img/products/performance-tee.jpg", alt: "Performance Tee" }],
  },
  {
    slug: "pocket-tee",
    name: "Heavyweight Pocket Tee",
    style: "6030CC",
    category: "t-shirts",
    kind: "tee",
    material: "100% garment-dyed cotton, 6.1 oz, chest pocket",
    blurb: "Garment-dyed cotton with a chest pocket and a relaxed cut.",
    description:
      "A garment-dyed heavyweight with a functional chest pocket and a relaxed, boxy cut. The pocket gives small left-chest marks a natural anchor point.",
    base_price: 14.0,
    compare_at: null,
    print_fee: 5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: false,
    sort: 9,
    colors: EARTH_COLORS,
    sizes: ADULT_SIZES,
    breaks: PREMIUM_BREAKS,
    images: [{ url: "/img/products/pocket-tee.jpg", alt: "Heavyweight Pocket Tee" }],
  },
  {
    slug: "heather-cvc-tee",
    name: "Heather CVC Tee",
    style: "3001CVC",
    category: "t-shirts",
    kind: "tee",
    material: "52% cotton / 48% polyester, 4.2 oz",
    blurb: "A soft heather blend with a subtle texture that hides creases.",
    description:
      "The heathered knit has a light texture that masks creases and prints with a soft, matte finish. A versatile middle ground between a cotton tee and a performance shirt.",
    base_price: 12.5,
    compare_at: null,
    print_fee: 4.5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: false,
    sort: 10,
    colors: HEATHER_COLORS,
    sizes: ADULT_SIZES_XS,
    breaks: TEE_BREAKS,
    images: [{ url: "/img/products/heather-cvc-tee.jpg", alt: "Heather CVC Tee" }],
  },
  {
    slug: "womens-fitted-tee",
    name: "Women's Fitted Tee",
    style: "G640L",
    category: "t-shirts",
    kind: "tee",
    material: "100% ring-spun cotton, 4.5 oz, women's fit",
    blurb: "A tapered, side-seamed cut with a contoured fit.",
    description:
      "Cut and sewn for a contoured fit with shorter sleeves and a tapered waist. The ring-spun cotton keeps the surface smooth so detailed prints stay crisp.",
    base_price: 10.5,
    compare_at: null,
    print_fee: 4.5,
    print_area: { frontW: 0.4, frontH: 0.48, backW: 0.58, backH: 0.62 },
    featured: false,
    sort: 11,
    colors: [
      { slug: "white", name: "White", hex: "#FFFFFF" },
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "teal", name: "Teal", hex: "#1F7A8C" },
      { slug: "heather-grey", name: "Heather Grey", hex: "#B9BCC0" },
      { slug: "navy", name: "Navy", hex: "#1F2A44" },
      { slug: "red", name: "Red", hex: "#C8102E" },
      { slug: "purple", name: "Purple", hex: "#4A2A6B" },
      { slug: "coral", name: "Coral", hex: "#E08A6E" },
    ],
    sizes: WOMEN_SIZES,
    breaks: TEE_BREAKS,
    images: [{ url: "/img/products/womens-fitted-tee.jpg", alt: "Women's Fitted Tee" }],
  },
  {
    slug: "youth-classic-tee",
    name: "Youth Classic Tee",
    style: "RT2000B",
    category: "t-shirts",
    kind: "tee",
    material: "100% cotton, 5.3 oz, youth fit",
    blurb: "The classic tee scaled down for kids' sizes.",
    description:
      "The same cotton body as our classic tee, cut for youth sizing. A dependable choice for school groups, teams and family runs.",
    base_price: 8.75,
    compare_at: null,
    print_fee: 4,
    print_area: { frontW: 0.4, frontH: 0.46, backW: 0.56, backH: 0.6 },
    featured: false,
    sort: 12,
    colors: CLASSIC_COLORS,
    sizes: YOUTH_SIZES,
    breaks: TEE_BREAKS,
    images: [{ url: "/img/products/youth-classic-tee.jpg", alt: "Youth Classic Tee" }],
  },
  {
    slug: "v-neck-tee",
    name: "V-Neck Tee",
    style: "3005",
    category: "t-shirts",
    kind: "tee",
    material: "100% ring-spun cotton, 4.3 oz",
    blurb: "A classic V-neck with a clean, covered collar.",
    description:
      "A ring-spun cotton V-neck with a narrow, covered collar that keeps its shape. A softer alternative to a crew neck for retail-style designs.",
    base_price: 11.0,
    compare_at: null,
    print_fee: 4.5,
    print_area: { frontW: 0.42, frontH: 0.5, backW: 0.62, backH: 0.66 },
    featured: false,
    sort: 13,
    colors: [
      { slug: "white", name: "White", hex: "#FFFFFF" },
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "navy", name: "Navy", hex: "#1F2A44" },
      { slug: "red", name: "Red", hex: "#C8102E" },
      { slug: "heather-grey", name: "Heather Grey", hex: "#B9BCC0" },
      { slug: "royal", name: "Royal", hex: "#1E4B9E" },
    ],
    sizes: ADULT_SIZES,
    breaks: TEE_BREAKS,
    images: [{ url: "/img/products/v-neck-tee.jpg", alt: "V-Neck Tee" }],
  },
  {
    slug: "long-sleeve-tee",
    name: "Long Sleeve Tee",
    style: "3200",
    category: "t-shirts",
    kind: "longsleeve",
    material: "100% ring-spun cotton, 4.5 oz, long sleeve",
    blurb: "Extra surface for sleeve prints, cuffs and full-length back art.",
    description:
      "Long sleeves open up print placements a short sleeve cannot take — full sleeve runs, cuff marks and a tall back panel. Ring-spun cotton keeps the surface smooth for detail.",
    base_price: 15.0,
    compare_at: null,
    print_fee: 5.5,
    print_area: { frontW: 0.4, frontH: 0.46, backW: 0.6, backH: 0.64 },
    featured: false,
    sort: 14,
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "white", name: "White", hex: "#FFFFFF" },
      { slug: "navy", name: "Navy", hex: "#1F2A44" },
      { slug: "sport-grey", name: "Sport Grey", hex: "#B4B4B6" },
      { slug: "royal", name: "Royal", hex: "#1E4B9E" },
      { slug: "red", name: "Red", hex: "#C8102E" },
    ],
    sizes: ADULT_SIZES,
    breaks: PREMIUM_BREAKS,
    images: [{ url: "/img/products/long-sleeve-tee.jpg", alt: "Long Sleeve Tee" }],
  },

  /* ------------------------------ Sweatshirts ---------------------------- */
  {
    slug: "minimalist-hoodie",
    name: "Minimalist Hoodie",
    style: "996",
    category: "sweatshirts",
    kind: "hoodie",
    material: "Brushed-back fleece, 8.0 oz / 271 gsm",
    blurb: "Brushed-back fleece with a double-lined hood and a wide back panel for artwork.",
    description:
      "The heaviest blank in the range. A brushed-back fleece gives a large front or back print a flat surface to sit on. The double-lined hood holds its shape, and ribbed cuffs and hem keep the sleeves in place during wear.",
    base_price: 32.0,
    compare_at: 38.0,
    print_fee: 7,
    print_area: { frontW: 0.46, frontH: 0.44, backW: 0.6, backH: 0.6 },
    featured: true,
    sort: 20,
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "charcoal", name: "Charcoal", hex: "#3A3A3C" },
      { slug: "forest", name: "Forest", hex: "#1F3D2B" },
      { slug: "oat", name: "Oat", hex: "#DCD2C0" },
      { slug: "navy", name: "Navy", hex: "#1F2A44" },
      { slug: "maroon", name: "Maroon", hex: "#5A1A22" },
    ],
    sizes: ADULT_SIZES,
    breaks: FLEECE_BREAKS,
    images: [{ url: "/img/products/minimalist-hoodie.jpg", alt: "Minimalist Hoodie" }],
  },
  {
    slug: "essential-crew",
    name: "Essential Crewneck",
    style: "562",
    category: "sweatshirts",
    kind: "crew",
    material: "Midweight fleece, 7.8 oz / 265 gsm",
    blurb: "A clean crewneck surface for left chest marks and mid-weight front prints.",
    description:
      "Midweight fleece sits between a tee and a hoodie. The flat front panel takes a left chest mark or a medium front print without the bulk of a full hoodie.",
    base_price: 28.0,
    compare_at: null,
    print_fee: 6.5,
    print_area: { frontW: 0.44, frontH: 0.44, backW: 0.6, backH: 0.6 },
    featured: true,
    sort: 21,
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "oat", name: "Oat", hex: "#DCD2C0" },
      { slug: "navy", name: "Navy", hex: "#1F2A44" },
      { slug: "wine", name: "Wine", hex: "#5C1F2C" },
      { slug: "sport-grey", name: "Sport Grey", hex: "#B4B4B6" },
      { slug: "forest", name: "Forest", hex: "#1F3D2B" },
    ],
    sizes: ADULT_SIZES,
    breaks: FLEECE_BREAKS,
    images: [{ url: "/img/products/essential-crew.jpg", alt: "Essential Crewneck" }],
  },

  /* ------------------------------- Headwear ------------------------------ */
  {
    slug: "urban-snapback",
    name: "Urban Snapback",
    style: "112",
    category: "headwear",
    kind: "cap",
    material: "Cotton twill front, mesh back, structured six-panel",
    blurb: "Structured six-panel trucker with a flat printable front panel.",
    description:
      "A structured six-panel with a flat cotton-twill front panel that takes a logo cleanly at small sizes, plus a breathable mesh back and an adjustable snap closure.",
    base_price: 14.0,
    compare_at: null,
    print_fee: 5,
    print_area: { frontW: 0.52, frontH: 0.42, backW: 0.52, backH: 0.42 },
    featured: true,
    sort: 30,
    colors: [
      { slug: "black", name: "Black", hex: "#141414" },
      { slug: "olive", name: "Olive", hex: "#4A4A33" },
      { slug: "stone", name: "Stone", hex: "#C8C2B4" },
      { slug: "navy", name: "Navy", hex: "#1F2A44" },
      { slug: "tan", name: "Tan", hex: "#B8A277" },
      { slug: "charcoal", name: "Charcoal", hex: "#3A3A3C" },
    ],
    sizes: [{ label: "One Size", surcharge: 0 }],
    breaks: ACCESSORY_BREAKS,
    images: [{ url: "/img/products/urban-snapback.jpg", alt: "Urban Snapback" }],
  },

  /* ------------------------------ Drinkware ------------------------------ */
  {
    slug: "kingdom-mug",
    name: "Kingdom Mug 11oz",
    style: "MUG11",
    category: "drinkware",
    kind: "mug",
    material: "Ceramic, 11oz",
    blurb: "Ceramic mug with a printable face for logos and artwork.",
    description:
      "Standard 11oz ceramic mug. Full wrap available on request for logos that run edge to edge.",
    base_price: 11.0,
    compare_at: null,
    print_fee: 4,
    print_area: { frontW: 0.66, frontH: 0.56, backW: 0.66, backH: 0.56 },
    featured: false,
    sort: 40,
    colors: [
      { slug: "white", name: "White", hex: "#FFFFFF" },
      { slug: "black", name: "Black", hex: "#141414" },
    ],
    sizes: [{ label: "11oz", surcharge: 0 }],
    breaks: ACCESSORY_BREAKS,
    images: [{ url: "/img/products/kingdom-mug.jpg", alt: "Kingdom Mug 11oz" }],
  },
];

const settings = {
  announcement: { value: "Free US shipping on orders over $75" },
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
        INSERT INTO products (slug, name, style_code, category_id, kind, blurb, description,
          material, base_price, compare_at, print_fee_per_side, print_area, featured, active, sort_order)
        VALUES (${p.slug}, ${p.name}, ${p.style}, ${catIds.get(p.category)}, ${p.kind},
          ${p.blurb}, ${p.description}, ${p.material}, ${p.base_price}, ${p.compare_at},
          ${p.print_fee}, ${tx.json(p.print_area)}, ${p.featured}, true, ${p.sort})
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
      for (const [i, img] of p.images.entries()) {
        await tx`
          INSERT INTO product_images (product_id, url, alt, sort_order)
          VALUES (${prod.id}, ${img.url}, ${img.alt}, ${i})`;
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
