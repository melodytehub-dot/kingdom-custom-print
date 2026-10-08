const ADULT_SWATCHES = [
  ["White", "#FFFFFF"], ["Ash", "#F1F1F1"], ["Ice Grey", "#DBDDDC"],
  ["Gravel", "#B3B2B7"], ["Sport Grey", "#B2ABB3"], ["Prairie Dust", "#A79780"],
  ["Stone Blue", "#7E93A7"], ["Brown Savana", "#9F877B"], ["Tweed", "#878A8F"],
  ["Dark Heather Grey", "#606671"], ["Charcoal", "#5A5657"], ["Blackberry", "#504259"],
  ["Black", "#131619"], ["Coral Silk", "#ff777f"], ["Azalea", "#FF76A0"],
  ["Antique Orange", "#FC7154"], ["Safety Pink", "#ef5682"], ["Heather Red", "#FB414D"],
  ["Heliconia", "#F73E86"], ["Orange", "#EC592F"], ["Sunset", "#C45C3D"],
  ["Heather Cardinal", "#C03545"], ["Berry", "#B53F66"], ["Red", "#B2000C"],
  ["Antique Cherry Red", "#871729"], ["Garnet", "#8B0000"], ["Cardinal Red", "#630928"],
  ["Maroon", "#420C24"], ["Vegas Gold", "#EED3A8"], ["Sand", "#C5BAA1"],
  ["Tan", "#C9B299"], ["Old Gold", "#E0B06E"], ["Tangerine", "#ff9e2c"],
  ["Neon Orange", "#F37827"], ["Texas Orange", "#AF5C37"], ["Dark Brown", "#2C1C0A"],
  ["Natural", "#FDF5DF"], ["Yellow Haze", "#EEE8A0"], ["Cornsilk", "#F8F393"],
  ["Yellow", "#FFE642"], ["Gold", "#FFCC00"], ["Olive", "#666633"],
  ["Mint Green", "#C3D9BC"], ["Pistachio", "#A2BF85"], ["Neon Green", "#A7E163"],
  ["Neon Yellow", "#CCF337"], ["Lime", "#7CC74A"], ["Kiwi", "#98AB64"],
  ["Antique Irish Green", "#02a469"], ["Kelly Green", "#06996c"], ["Turf Green", "#067C4A"],
  ["Irish Green", "#00802B"], ["Military Green", "#414623"], ["Forest Green", "#0D3A15"],
  ["Tropical Blue", "#00889B"], ["Antique Jade Dome", "#00817F"], ["Jade Dome", "#008065"],
  ["Galapagos Blue", "#006269"], ["Light Blue", "#A9BDD8"], ["Carolina Blue", "#5689B9"],
  ["Heather Sapphire", "#3398D8"], ["Iris", "#2277BC"], ["Metro Blue", "#385499"],
  ["Cobalt", "#374393"], ["Heather Indigo", "#464E7E"], ["Turquoise", "#0088B7"],
  ["Lilac", "#433F76"], ["Indigo Blue", "#45586b"], ["Royal", "#003296"],
  ["Heather Navy", "#313A4D"], ["Navy", "#20304A"], ["Midnight", "#1b2c37"],
  ["Orchid", "#c5b4e3"], ["Violet", "#8872AC"], ["Purple", "#4D2379"],
  ["Light Pink", "#F2C2DB"], ["Heather Radiant Orchid", "#e68dc7"],
];

const YOUTH_SWATCHES = [
  ["White", "#FFFFFF"], ["Ash", "#F1F1F1"], ["Sport Grey", "#B2ABB3"],
  ["Dark Heather Grey", "#606671"], ["Charcoal", "#5A5657"], ["Graphite Heather", "#4f4d52"],
  ["Black", "#131619"], ["Coral Silk", "#ff777f"], ["Azalea", "#FF76A0"],
  ["Safety Pink", "#ef5682"], ["Heather Red", "#FB414D"], ["Heliconia", "#F73E86"],
  ["Orange", "#EC592F"], ["Red", "#B2000C"], ["Garnet", "#8B0000"],
  ["Cardinal Red", "#630928"], ["Maroon", "#420C24"], ["Sand", "#C5BAA1"],
  ["Tangerine", "#ff9e2c"], ["Neon Orange", "#F37827"], ["Texas Orange", "#AF5C37"],
  ["Dark Brown", "#2C1C0A"], ["Natural", "#FDF5DF"], ["Yellow Haze", "#EEE8A0"],
  ["Yellow", "#FFE642"], ["Gold", "#FFCC00"], ["Mint Green", "#C3D9BC"],
  ["Neon Green", "#A7E163"], ["Neon Yellow", "#CCF337"], ["Lime", "#7CC74A"],
  ["Kiwi", "#98AB64"], ["Kelly Green", "#06996c"], ["Irish Green", "#00802B"],
  ["Military Green", "#414623"], ["Forest Green", "#0D3A15"], ["Tropical Blue", "#00889B"],
  ["Jade Dome", "#008065"], ["Light Blue", "#A9BDD8"], ["Carolina Blue", "#5689B9"],
  ["Heather Sapphire", "#3398D8"], ["Cobalt", "#374393"], ["Indigo Blue", "#45586b"],
  ["Royal", "#003296"], ["Heather Navy", "#313A4D"], ["Navy", "#20304A"],
  ["Violet", "#8872AC"], ["Purple", "#4D2379"], ["Light Pink", "#F2C2DB"],
];

function toVariants(swatches) {
  return swatches.map(([name, hex]) => ({
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    hex,
  }));
}

export const RT2000_COLORS = toVariants(ADULT_SWATCHES);
export const RT2000B_COLORS = toVariants(YOUTH_SWATCHES);
