/**
 * Built-in clipart for the design studio's "Add art" tool.
 * Each piece is a self-contained SVG encoded as a data URL so it can be
 * dropped straight into an image layer and flattened by the canvas exporter.
 */

function svg(inner: string, viewBox = "0 0 100 100"): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="#141414">${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(doc)}`;
}

export interface ArtItem {
  id: string;
  name: string;
  src: string;
  category?: ArtCategory;
}

export type ArtCategory = "Symbols" | "Sports" | "Faith" | "Nature";

export const ART_CATEGORIES = ["All", "Symbols", "Sports", "Faith", "Nature"] as const;

function categorizedArt(id: string, name: string, category: ArtCategory, inner: string): ArtItem {
  return { id, name, category, src: svg(inner) };
}

export const ART_LIBRARY: ArtItem[] = [
  {
    id: "star",
    name: "Star",
    src: svg(
      `<path d="M50 6 61.8 37.6 95.6 39l-26.5 21.4 8.6 32.6L50 74.5 22.3 93l8.6-32.6L4.4 39l33.8-1.4z"/>`
    ),
  },
  {
    id: "burst",
    name: "Burst",
    src: svg(
      `<path d="M50 2 57 22 74 9l-3 21 21-3-13 17 20 7-20 7 13 17-21-3 3 21-17-13-7 20-7-20-17 13 3-21-21 3 13-17-20-7 20-7L6 27l21 3-3-21 17 13z"/>`
    ),
  },
  {
    id: "banner",
    name: "Banner",
    src: svg(
      `<path d="M6 30h88v40H6z"/><path d="M6 30 0 50l6 20zM94 30l6 20-6 20z" fill="#141414"/>`,
      "0 0 100 100"
    ),
  },
  {
    id: "circle",
    name: "Badge",
    src: svg(`<circle cx="50" cy="50" r="46"/>`),
  },
  {
    id: "ring",
    name: "Ring",
    src: svg(`<path d="M50 4a46 46 0 1 0 0 92 46 46 0 0 0 0-92zm0 12a34 34 0 1 1 0 68 34 34 0 0 1 0-68z"/>`),
  },
  {
    id: "arrow",
    name: "Arrow",
    src: svg(`<path d="M6 42h58V20l30 30-30 30V58H6z"/>`),
  },
  {
    id: "heart",
    name: "Heart",
    src: svg(
      `<path d="M50 88C22 68 8 54 8 36a24 24 0 0 1 42-15 24 24 0 0 1 42 15c0 18-14 32-42 52z"/>`
    ),
  },
  {
    id: "crown",
    name: "Crown",
    src: svg(
      `<path d="M8 30 30 48 50 18l20 30 22-18-8 50H16z"/><rect x="16" y="82" width="68" height="10" rx="2"/>`
    ),
  },
  {
    id: "bolt",
    name: "Bolt",
    src: svg(`<path d="M58 4 20 56h24l-8 40 38-52H50z"/>`),
  },
  {
    id: "sun",
    name: "Sunburst",
    src: svg(
      `<g><circle cx="50" cy="50" r="18"/>${Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 50 + Math.cos(a) * 26;
        const y1 = 50 + Math.sin(a) * 26;
        const x2 = 50 + Math.cos(a) * 46;
        const y2 = 50 + Math.sin(a) * 46;
        return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="#141414" stroke-width="7" stroke-linecap="round"/>`;
      }).join("")}</g>`
    ),
  },
  {
    id: "palm",
    name: "Sunset",
    src: svg(
      `<rect x="0" y="62" width="100" height="38"/><circle cx="50" cy="50" r="20"/>`
    ),
  },
  {
    id: "cross",
    name: "Cross",
    src: svg(`<path d="M38 4h24v34h34v24H62v34H38V62H4V38h34z"/>`),
  },
  categorizedArt("basketball", "Basketball", "Sports", `<circle cx="50" cy="50" r="42" fill="none" stroke="#141414" stroke-width="7"/><path d="M8 50h84M50 8v84M20 20c20 14 28 30 30 72M80 20C60 34 52 50 50 92" fill="none" stroke="#141414" stroke-width="6"/>`),
  categorizedArt("football", "Football", "Sports", `<ellipse cx="50" cy="50" rx="43" ry="27" transform="rotate(-28 50 50)" fill="none" stroke="#141414" stroke-width="7"/><path d="m18 67 64-34M43 48l10 18m-2-23 10 18m-22-13 10 18" fill="none" stroke="#141414" stroke-width="5" stroke-linecap="round"/>`),
  categorizedArt("soccer", "Soccer Ball", "Sports", `<circle cx="50" cy="50" r="44" fill="none" stroke="#141414" stroke-width="6"/><path d="m50 28 15 11-6 18H41l-6-18zm0-22-10 22m25 11 24-2M59 57l11 25M41 57 30 82M35 39 11 37m40-9 10-21" fill="#141414" stroke="#141414" stroke-width="4" stroke-linejoin="round"/>`),
  categorizedArt("baseball", "Baseball", "Sports", `<circle cx="50" cy="50" r="43" fill="none" stroke="#141414" stroke-width="6"/><path d="M29 15c12 18 12 52 0 70M71 15c-12 18-12 52 0 70M25 29l9 4m-10 6 9 4m-9 6 9 4m-7 6 8 3m-7 7 8 3m33-43-9 4m10 6-9 4m9 6-9 4m7 6-8 3m7 7-8 3" fill="none" stroke="#141414" stroke-width="3" stroke-linecap="round"/>`),
  categorizedArt("trophy", "Trophy", "Sports", `<path d="M31 10h38v18c0 20-7 31-19 35-12-4-19-15-19-35zM31 18H12v12c0 16 9 23 24 23m33-35h19v12c0 16-9 23-24 23M50 63v18m-18 9h36M39 81h22" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  categorizedArt("fish", "Faith Fish", "Faith", `<path d="M8 50c20-26 54-31 75-6l12 6-12 6c-21 25-55 20-75-6zm0 0 18-1m14-20 12 42" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="70" cy="45" r="3"/>`),
  categorizedArt("bible", "Open Bible", "Faith", `<path d="M50 25c-13-12-29-13-41-8v59c13-5 28-4 41 8 13-12 28-13 41-8V17c-12-5-28-4-41 8zm0 0v59M18 31c9-3 18-1 25 4m-25 9c9-3 18-1 25 4m39-17c-9-3-18-1-25 4m25 9c-9-3-18-1-25 4" fill="none" stroke="#141414" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  categorizedArt("church", "Church", "Faith", `<path d="M50 9v20m-9-10h18M15 91V49l35-23 35 23v42M34 91V67h32v24M8 91h84" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  categorizedArt("dove", "Dove", "Faith", `<path d="M12 58c17-2 27-11 34-31 6 12 13 18 24 21l17-12-5 18 12 12-23 1c-12 17-35 24-59 6l15-4zm30-16-17-3 9 15m26-6 9-11M36 76l24-15" fill="none" stroke="#141414" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  categorizedArt("flower", "Flower", "Nature", `<g>${Array.from({ length: 8 }, (_, index) => `<ellipse cx="50" cy="27" rx="10" ry="19" transform="rotate(${index * 45} 50 50)"/>`).join("")}<circle cx="50" cy="50" r="12"/><path d="M50 62v31m0-12c-9-12-17-10-22-8 4 9 12 13 22 11m0-9c8-12 16-10 22-8-4 9-12 13-22 11"/></g>`),
  categorizedArt("leaf", "Leaf", "Nature", `<path d="M85 12C45 12 17 27 14 57c-2 20 14 31 30 27 26-6 41-37 41-72zM17 83c13-21 31-38 54-55M37 63l-3-20m17 8 18-3" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  categorizedArt("mountains", "Mountains", "Nature", `<path d="m5 83 27-47 14 22 18-38 31 63z"/><path d="m24 51 8-15 9 14m15-14 8-16 11 19" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M8 91h84" fill="none" stroke="#141414" stroke-width="6" stroke-linecap="round"/>`),
  categorizedArt("wave", "Ocean Wave", "Nature", `<path d="M7 55c12-16 24-16 36 0s24 16 36 0 12-16 14-15c-2 28-18 50-43 50C28 90 12 76 7 55zm4-22c10-13 20-13 30 0m8 0c10-13 20-13 30 0" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  categorizedArt("butterfly", "Butterfly", "Nature", `<path d="M49 48C39 20 13 8 10 28c-3 15 10 24 27 27-18-2-27 8-22 19 7 15 25 4 34-13 9 17 27 28 34 13 5-11-4-21-22-19 17-3 30-12 27-27-3-20-29-8-39 20zm1 0v38m-2-53-8-12m11 12 8-12" fill="none" stroke="#141414" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  categorizedArt("paw", "Paw Print", "Symbols", `<ellipse cx="50" cy="68" rx="25" ry="20"/><ellipse cx="19" cy="39" rx="9" ry="13" transform="rotate(-25 19 39)"/><ellipse cx="40" cy="24" rx="9" ry="13" transform="rotate(-10 40 24)"/><ellipse cx="62" cy="24" rx="9" ry="13" transform="rotate(10 62 24)"/><ellipse cx="82" cy="39" rx="9" ry="13" transform="rotate(25 82 39)"/>`),
  categorizedArt("smile", "Smiley Face", "Symbols", `<circle cx="50" cy="50" r="43" fill="none" stroke="#141414" stroke-width="7"/><circle cx="35" cy="40" r="5"/><circle cx="65" cy="40" r="5"/><path d="M28 58c7 15 16 22 22 22s15-7 22-22" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round"/>`),
  categorizedArt("peace", "Peace Sign", "Symbols", `<circle cx="50" cy="50" r="43" fill="none" stroke="#141414" stroke-width="7"/><path d="M50 7v86M50 51 20 80m30-29 30 29" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round"/>`),
  categorizedArt("anchor", "Anchor", "Symbols", `<circle cx="50" cy="21" r="10" fill="none" stroke="#141414" stroke-width="7"/><path d="M50 31v53M28 47h44M12 66c3 18 16 27 29 27 17 0 25-11 29-27l15 12M12 66l15 12" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`),
  categorizedArt("music", "Music Note", "Symbols", `<path d="M57 18v53m0-53 29-7v53M57 31l29-7M43 71c0 8-8 15-18 15S9 81 9 74s8-15 18-15 16 5 16 12zm43-3c0 8-8 15-18 15s-16-5-16-12 8-15 18-15 16 5 16 12z"/>`),
  categorizedArt("globe", "Globe", "Symbols", `<circle cx="50" cy="50" r="43" fill="none" stroke="#141414" stroke-width="6"/><ellipse cx="50" cy="50" rx="19" ry="43" fill="none" stroke="#141414" stroke-width="5"/><path d="M9 39h82M9 61h82" fill="none" stroke="#141414" stroke-width="5"/>`),
];
