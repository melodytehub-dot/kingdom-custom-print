// Real RushOrderTees "Classic Tee" (RT2000) colourways.
// Photos are model shots of the same body, so a colour change swaps the
// garment image without changing the pose. Front = "_fr", back = "_bk".

export interface TeeMockup {
  code: string;
  slug: string;
  name: string;
  hex: string;
  front: string;
  back: string;
}

const B = "/img/mockups/tee";

export const TEE_MOCKUPS: TeeMockup[] = [
  { code: "WHT", slug: "white", name: "White", hex: "#FFFFFF", front: `${B}/WHT_fr.jpg`, back: `${B}/WHT_bk.jpg` },
  { code: "ASH", slug: "ash", name: "Ash", hex: "#F1F1F1", front: `${B}/ASH_fr.jpg`, back: `${B}/ASH_bk.jpg` },
  { code: "NATL", slug: "natural", name: "Natural", hex: "#FDF5DF", front: `${B}/NATL_fr.jpg`, back: `${B}/NATL_bk.jpg` },
  { code: "SAND", slug: "sand", name: "Sand", hex: "#C5BAA1", front: `${B}/SAND_fr.jpg`, back: `${B}/SAND_bk.jpg` },
  { code: "SPGY", slug: "sport-grey", name: "Sport Grey", hex: "#B2ABB3", front: `${B}/SPGY_fr.jpg`, back: `${B}/SPGY_bk.jpg` },
  { code: "DKHG", slug: "dark-heather", name: "Dark Heather", hex: "#606671", front: `${B}/DKHG_fr.jpg`, back: `${B}/DKHG_bk.jpg` },
  { code: "HTHN", slug: "heather-navy", name: "Heather Navy", hex: "#313A4D", front: `${B}/HTHN_fr.jpg`, back: `${B}/HTHN_bk.jpg` },
  { code: "CHAR", slug: "charcoal", name: "Charcoal", hex: "#5A5657", front: `${B}/CHAR_fr.jpg`, back: `${B}/CHAR_bk.jpg` },
  { code: "BLK", slug: "black", name: "Black", hex: "#131619", front: `${B}/BLK_fr.jpg`, back: `${B}/BLK_bk.jpg` },
  { code: "NAVY", slug: "navy", name: "Navy", hex: "#20304A", front: `${B}/NAVY_fr.jpg`, back: `${B}/NAVY_bk.jpg` },
  { code: "ROYL", slug: "royal", name: "Royal", hex: "#003296", front: `${B}/ROYL_fr.jpg`, back: `${B}/ROYL_bk.jpg` },
  { code: "CARB", slug: "carolina-blue", name: "Carolina Blue", hex: "#5689B9", front: `${B}/CARB_fr.jpg`, back: `${B}/CARB_bk.jpg` },
  { code: "LB", slug: "light-blue", name: "Light Blue", hex: "#A9BDD8", front: `${B}/LB_fr.jpg`, back: `${B}/LB_bk.jpg` },
  { code: "55", slug: "metro-blue", name: "Metro Blue", hex: "#385499", front: `${B}/55_fr.jpg`, back: `${B}/55_bk.jpg` },
  { code: "8", slug: "indigo-blue", name: "Indigo Blue", hex: "#45586b", front: `${B}/8_fr.jpg`, back: `${B}/8_bk.jpg` },
  { code: "RED", slug: "red", name: "Red", hex: "#B2000C", front: `${B}/RED_fr.jpg`, back: `${B}/RED_bk.jpg` },
  { code: "MAR", slug: "maroon", name: "Maroon", hex: "#420C24", front: `${B}/MAR_fr.jpg`, back: `${B}/MAR_bk.jpg` },
  { code: "CARD", slug: "cardinal-red", name: "Cardinal Red", hex: "#630928", front: `${B}/CARD_fr.jpg`, back: `${B}/CARD_bk.jpg` },
  { code: "HRED", slug: "heather-red", name: "Heather Red", hex: "#FB414D", front: `${B}/HRED_fr.jpg`, back: `${B}/HRED_bk.jpg` },
  { code: "ORNG", slug: "orange", name: "Orange", hex: "#EC592F", front: `${B}/ORNG_fr.jpg`, back: `${B}/ORNG_bk.jpg` },
  { code: "TANG", slug: "tangerine", name: "Tangerine", hex: "#ff9e2c", front: `${B}/TANG_fr.jpg`, back: `${B}/TANG_bk.jpg` },
  { code: "GOLD", slug: "gold", name: "Gold", hex: "#FFCC00", front: `${B}/GOLD_fr.jpg`, back: `${B}/GOLD_bk.jpg` },
  { code: "YLW", slug: "yellow", name: "Yellow", hex: "#FFE642", front: `${B}/YLW_fr.jpg`, back: `${B}/YLW_bk.jpg` },
  { code: "FGRN", slug: "forest-green", name: "Forest Green", hex: "#0D3A15", front: `${B}/FGRN_fr.jpg`, back: `${B}/FGRN_bk.jpg` },
  { code: "IRGN", slug: "irish-green", name: "Irish Green", hex: "#00802B", front: `${B}/IRGN_fr.jpg`, back: `${B}/IRGN_bk.jpg` },
  { code: "42", slug: "kelly-green", name: "Kelly Green", hex: "#06996c", front: `${B}/42_fr.jpg`, back: `${B}/42_bk.jpg` },
  { code: "MILG", slug: "military-green", name: "Military Green", hex: "#414623", front: `${B}/MILG_fr.jpg`, back: `${B}/MILG_bk.jpg` },
  { code: "PURP", slug: "purple", name: "Purple", hex: "#4D2379", front: `${B}/PURP_fr.jpg`, back: `${B}/PURP_bk.jpg` },
  { code: "HELI", slug: "heliconia", name: "Heliconia", hex: "#F73E86", front: `${B}/HELI_fr.jpg`, back: `${B}/HELI_bk.jpg` },
  { code: "PINK", slug: "light-pink", name: "Light Pink", hex: "#F2C2DB", front: `${B}/PINK_fr.jpg`, back: `${B}/PINK_bk.jpg` },
  { code: "TURQ", slug: "turquoise", name: "Turquoise", hex: "#0088B7", front: `${B}/TURQ_fr.jpg`, back: `${B}/TURQ_bk.jpg` },
  { code: "DKBN", slug: "dark-brown", name: "Dark Brown", hex: "#2C1C0A", front: `${B}/DKBN_fr.jpg`, back: `${B}/DKBN_bk.jpg` },
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
