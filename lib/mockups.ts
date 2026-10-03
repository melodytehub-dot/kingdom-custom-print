// RushOrderTees "Classic Tee" (RT2000) colourways as flat, body-free garment
// mockups (ghost-mannequin shading composited from ROT's texture + mask, tinted
// per colour). Front = "_fr", back = "_bk".

export interface TeeMockup {
  code: string;
  slug: string;
  name: string;
  hex: string;
  front: string;
  back: string;
}

// High-contrast transparent ghost-mannequin renders used by the studio.
// The garment is isolated from its background so artwork stays crisp and
// the stage can inherit the site's bone background.
const B = "/img/mockups/garment";

export const TEE_MOCKUPS: TeeMockup[] = [
  { code: "WHT", slug: "white", name: "White", hex: "#FFFFFF", front: `${B}/WHT_fr.webp`, back: `${B}/WHT_bk.webp` },
  { code: "ASH", slug: "ash", name: "Ash", hex: "#F1F1F1", front: `${B}/ASH_fr.webp`, back: `${B}/ASH_bk.webp` },
  { code: "NATL", slug: "natural", name: "Natural", hex: "#FDF5DF", front: `${B}/NATL_fr.webp`, back: `${B}/NATL_bk.webp` },
  { code: "SAND", slug: "sand", name: "Sand", hex: "#C5BAA1", front: `${B}/SAND_fr.webp`, back: `${B}/SAND_bk.webp` },
  { code: "SPGY", slug: "sport-grey", name: "Sport Grey", hex: "#B2ABB3", front: `${B}/SPGY_fr.webp`, back: `${B}/SPGY_bk.webp` },
  { code: "DKHG", slug: "dark-heather", name: "Dark Heather", hex: "#606671", front: `${B}/DKHG_fr.webp`, back: `${B}/DKHG_bk.webp` },
  { code: "HTHN", slug: "heather-navy", name: "Heather Navy", hex: "#313A4D", front: `${B}/HTHN_fr.webp`, back: `${B}/HTHN_bk.webp` },
  { code: "CHAR", slug: "charcoal", name: "Charcoal", hex: "#5A5657", front: `${B}/CHAR_fr.webp`, back: `${B}/CHAR_bk.webp` },
  { code: "BLK", slug: "black", name: "Black", hex: "#131619", front: `${B}/BLK_fr.webp`, back: `${B}/BLK_bk.webp` },
  { code: "NAVY", slug: "navy", name: "Navy", hex: "#20304A", front: `${B}/NAVY_fr.webp`, back: `${B}/NAVY_bk.webp` },
  { code: "ROYL", slug: "royal", name: "Royal", hex: "#003296", front: `${B}/ROYL_fr.webp`, back: `${B}/ROYL_bk.webp` },
  { code: "CARB", slug: "carolina-blue", name: "Carolina Blue", hex: "#5689B9", front: `${B}/CARB_fr.webp`, back: `${B}/CARB_bk.webp` },
  { code: "LB", slug: "light-blue", name: "Light Blue", hex: "#A9BDD8", front: `${B}/LB_fr.webp`, back: `${B}/LB_bk.webp` },
  { code: "55", slug: "metro-blue", name: "Metro Blue", hex: "#385499", front: `${B}/55_fr.webp`, back: `${B}/55_bk.webp` },
  { code: "8", slug: "indigo-blue", name: "Indigo Blue", hex: "#45586b", front: `${B}/8_fr.webp`, back: `${B}/8_bk.webp` },
  { code: "RED", slug: "red", name: "Red", hex: "#B2000C", front: `${B}/RED_fr.webp`, back: `${B}/RED_bk.webp` },
  { code: "MAR", slug: "maroon", name: "Maroon", hex: "#420C24", front: `${B}/MAR_fr.webp`, back: `${B}/MAR_bk.webp` },
  { code: "CARD", slug: "cardinal-red", name: "Cardinal Red", hex: "#630928", front: `${B}/CARD_fr.webp`, back: `${B}/CARD_bk.webp` },
  { code: "HRED", slug: "heather-red", name: "Heather Red", hex: "#FB414D", front: `${B}/HRED_fr.webp`, back: `${B}/HRED_bk.webp` },
  { code: "ORNG", slug: "orange", name: "Orange", hex: "#EC592F", front: `${B}/ORNG_fr.webp`, back: `${B}/ORNG_bk.webp` },
  { code: "TANG", slug: "tangerine", name: "Tangerine", hex: "#ff9e2c", front: `${B}/TANG_fr.webp`, back: `${B}/TANG_bk.webp` },
  { code: "GOLD", slug: "gold", name: "Gold", hex: "#FFCC00", front: `${B}/GOLD_fr.webp`, back: `${B}/GOLD_bk.webp` },
  { code: "YLW", slug: "yellow", name: "Yellow", hex: "#FFE642", front: `${B}/YLW_fr.webp`, back: `${B}/YLW_bk.webp` },
  { code: "FGRN", slug: "forest-green", name: "Forest Green", hex: "#0D3A15", front: `${B}/FGRN_fr.webp`, back: `${B}/FGRN_bk.webp` },
  { code: "IRGN", slug: "irish-green", name: "Irish Green", hex: "#00802B", front: `${B}/IRGN_fr.webp`, back: `${B}/IRGN_bk.webp` },
  { code: "42", slug: "kelly-green", name: "Kelly Green", hex: "#06996c", front: `${B}/42_fr.webp`, back: `${B}/42_bk.webp` },
  { code: "MILG", slug: "military-green", name: "Military Green", hex: "#414623", front: `${B}/MILG_fr.webp`, back: `${B}/MILG_bk.webp` },
  { code: "PURP", slug: "purple", name: "Purple", hex: "#4D2379", front: `${B}/PURP_fr.webp`, back: `${B}/PURP_bk.webp` },
  { code: "HELI", slug: "heliconia", name: "Heliconia", hex: "#F73E86", front: `${B}/HELI_fr.webp`, back: `${B}/HELI_bk.webp` },
  { code: "PINK", slug: "light-pink", name: "Light Pink", hex: "#F2C2DB", front: `${B}/PINK_fr.webp`, back: `${B}/PINK_bk.webp` },
  { code: "TURQ", slug: "turquoise", name: "Turquoise", hex: "#0088B7", front: `${B}/TURQ_fr.webp`, back: `${B}/TURQ_bk.webp` },
  { code: "DKBN", slug: "dark-brown", name: "Dark Brown", hex: "#2C1C0A", front: `${B}/DKBN_fr.webp`, back: `${B}/DKBN_bk.webp` },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Finds the mockup that best matches a product colour by name, then by hex. */
export function mockupForColor(name: string, hex: string): TeeMockup | undefined {
  const n = norm(name);
  const byName = TEE_MOCKUPS.find((m) => norm(m.name) === n);
  if (byName) return byName;
  const bySlug = TEE_MOCKUPS.find((m) => m.slug === name);
  if (bySlug) return bySlug;
  const h = hex.replace("#", "").toLowerCase();
  return TEE_MOCKUPS.find((m) => m.hex.replace("#", "").toLowerCase() === h);
}

export function mockupByCode(code: string): TeeMockup | undefined {
  return TEE_MOCKUPS.find((m) => m.code === code);
}
