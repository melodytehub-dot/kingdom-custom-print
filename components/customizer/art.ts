/**
 * Built-in clipart for the design studio's "Add art" tool.
 * Each piece is a self-contained SVG encoded as a data URL so it can be
 * dropped straight into an image layer and flattened by the canvas exporter.
 */

function svg(inner: string, viewBox = "0 0 100 100"): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="#141414">${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(doc)}`;
}

/** Outline path — the house style for line-art icons. */
function line(d: string, width = 7): string {
  return `<path d="${d}" fill="none" stroke="#141414" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Evenly spaced radial spokes, used by sun, snowflake and gear icons. */
function spokes(count: number, inner: number, outer: number, width = 7, offset = 0): string {
  return Array.from({ length: count }, (_, i) => {
    const a = ((i * (360 / count) + offset) * Math.PI) / 180;
    const x1 = 50 + Math.cos(a) * inner;
    const y1 = 50 + Math.sin(a) * inner;
    const x2 = 50 + Math.cos(a) * outer;
    const y2 = 50 + Math.sin(a) * outer;
    return line(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`, width);
  }).join("");
}

/** Small forked twigs at the tip of each spoke (snowflake arms). */
function twigs(count: number, radius: number, length: number, width = 5, spread = 38): string {
  return Array.from({ length: count }, (_, i) => {
    const a = (i * (360 / count) * Math.PI) / 180;
    const cx = 50 + Math.cos(a) * radius;
    const cy = 50 + Math.sin(a) * radius;
    return [-spread, spread]
      .map((offset) => {
        const b = a + (offset * Math.PI) / 180;
        const x = cx + Math.cos(b) * length;
        const y = cy + Math.sin(b) * length;
        return line(`M${cx.toFixed(1)} ${cy.toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`, width);
      })
      .join("");
  }).join("");
}

/** A filled circle subpath, for transparent holes via fill-rule="evenodd". */
function hole(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}a${r} ${r} 0 1 0 0 ${r * 2} ${r} ${r} 0 1 0 0 ${-r * 2}z`;
}

function evenodd(d: string): string {
  return `<path fill-rule="evenodd" d="${d}"/>`;
}

/** Polygon cog (gear) outline, ready for fill-rule="evenodd". */
function cog(teeth: number, outer: number, root: number): string {
  const step = (Math.PI * 2) / teeth;
  const halfTooth = step * 0.17;
  const flare = step * 0.12;
  const polar = (radius: number, angle: number) =>
    `${(50 + Math.cos(angle) * radius).toFixed(1)} ${(50 + Math.sin(angle) * radius).toFixed(1)}`;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    d += `${i === 0 ? "M" : "L"}${polar(root, a - halfTooth - flare)}`;
    d += `L${polar(outer, a - halfTooth)}`;
    d += `L${polar(outer, a + halfTooth)}`;
    d += `L${polar(root, a + halfTooth + flare)}`;
  }
  return `${d}Z`;
}

export interface ArtItem {
  id: string;
  name: string;
  src: string;
  category?: ArtCategory;
}

export type ArtCategory = "Symbols" | "Sports" | "Faith" | "Nature" | "Animals";

export const ART_CATEGORIES = ["All", "Symbols", "Sports", "Faith", "Nature", "Animals"] as const;

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
  categorizedArt("shield", "Shield", "Symbols", `<path d="M50 6 88 20v30c0 24-16 37-38 44C28 87 12 74 12 50V20z"/>`),
  categorizedArt("shield-check", "Protected", "Symbols", `<g>${line("M50 6 88 20v30c0 24-16 37-38 44C28 87 12 74 12 50V20z", 7)}${line("M32 50l12 12 24-26", 8)}</g>`),
  categorizedArt("diamond", "Diamond", "Symbols", `<path d="M28 12h44l18 24-40 52L10 36z"/><path d="M10 36h80M28 12l8 24 14-24 14 24 8-24M36 36l14 52 14-52" fill="none" stroke="#fff" stroke-width="3"/>`),
  categorizedArt("flame", "Flame", "Symbols", `<path d="M50 5c15 21 27 29 27 47a27 27 0 0 1-54 0c0-10 5-18 12-26 1 8 4 13 9 16-3-15 0-26 6-37z"/>`),
  categorizedArt("skull", "Skull", "Symbols", `<path fill-rule="evenodd" d="M50 7C33 7 20 20 20 38c0 11 5 19 11 24l1 15a6 6 0 0 0 6 6h24a6 6 0 0 0 6-6l1-15c6-5 11-13 11-24C80 20 67 7 50 7z${hole(37, 39, 9)}${hole(63, 39, 9)}M50 55l7 12H43z"/>`),
  categorizedArt("sparkle", "Sparkle", "Symbols", `<path d="M50 4c4 23 19 38 42 42-23 4-38 19-42 42-4-23-19-38-42-42 23-4 38-19 42-42z"/>`),
  categorizedArt("sparkles", "Sparkles", "Symbols", `<path d="M40 6c3 17 14 28 31 31-17 3-28 14-31 31-3-17-14-28-31-31 17-3 28-14 31-31z"/><path d="M78 52c2 9 7 15 16 16-9 2-14 7-16 16-2-9-7-14-16-16 9-1 14-7 16-16z"/>`),
  categorizedArt("target", "Target", "Symbols", `<g>${line("M50 8a42 42 0 1 0 0.1 0z", 7)}${line("M50 30a20 20 0 1 0 0.1 0z", 7)}</g><circle cx="50" cy="50" r="8"/>`),
  categorizedArt("compass", "Compass", "Symbols", `<g>${line("M50 8a42 42 0 1 0 0.1 0z", 7)}${line("M50 22v10M50 68v10M22 50h10M68 50h10", 6)}</g><path d="m68 32-10 26-26 10 10-26z"/>`),
  categorizedArt("rocket", "Rocket", "Symbols", `<g>${line("M50 5c13 12 20 29 20 48v14H30V53C30 34 37 17 50 5z", 8)}${line("M50 26a10 10 0 1 0 0.1 0z", 7)}${line("M30 67 14 86l20-8M70 67l16 19-20-8M44 67v16a6 6 0 0 0 12 0V67", 7)}</g>`),
  categorizedArt("gear", "Gear", "Symbols", `${evenodd(`${cog(9, 44, 30)}${hole(50, 50, 14)}`)}`),
  categorizedArt("clock", "Clock", "Symbols", `<g>${line("M50 8a42 42 0 1 0 0.1 0z", 7)}${line("M50 24v28l20 13", 7)}</g>`),
  categorizedArt("camera", "Camera", "Symbols", `<g>${line("M50 30a20 20 0 1 0 0.1 0z", 7)}</g><path fill-rule="evenodd" d="M12 26h18l6-12h28l6 12h18a6 6 0 0 1 6 6v50a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V32a6 6 0 0 1 6-6zm38 8a20 20 0 1 0 0 40 20 20 0 0 0 0-40z"/>`),
  categorizedArt("map-pin", "Location Pin", "Symbols", `<path fill-rule="evenodd" d="M50 5c-16 0-29 13-29 29 0 21 29 60 29 60s29-39 29-60c0-16-13-29-29-29zm0 18a11 11 0 1 0 0 22 11 11 0 0 0 0-22z"/>`),
  categorizedArt("controller", "Game Controller", "Symbols", `<path fill-rule="evenodd" d="M30 32h40c12 0 20 9 20 21 0 11-6 21-15 21-7 0-12-5-16-11H41c-4 6-9 11-16 11-9 0-15-10-15-21 0-12 8-21 20-21zm2 12v5h-5v6h5v5h6v-5h5v-6h-5v-5zm34-2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm11 9a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>`),
  categorizedArt("speech", "Speech Bubble", "Symbols", `<path d="M10 18h80a4 4 0 0 1 4 4v44a4 4 0 0 1-4 4H48L24 92V70H10a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4z"/>`),
  categorizedArt("check", "Check Mark", "Symbols", `${line("M12 52l26 26 50-58", 14)}`),
  categorizedArt("infinity", "Infinity", "Symbols", `${line("M32 34c-13 0-22 7-22 16s9 16 22 16c16 0 24-16 36-16 13 0 22 7 22 16s-9 16-22 16c-12 0-20-16-36-16z", 9)}`),
  categorizedArt("key", "Key", "Symbols", `<path fill-rule="evenodd" d="M40 12a28 28 0 1 0 24 42l6 0 4 8h12v-12h8v-12h-30A28 28 0 0 0 40 12zm0 16a12 12 0 1 1 0 24 12 12 0 0 1 0-24z"/>`),
  categorizedArt("eye", "Eye", "Symbols", `${evenodd(`M4 50C18 28 34 20 50 20s32 8 46 30c-14 22-30 30-46 30S18 72 4 50z${hole(50, 50, 17)}`)}<circle cx="50" cy="50" r="8"/>`),
  categorizedArt("wifi", "Signal", "Symbols", `<g>${line("M20 42a44 44 0 0 1 60 0", 9)}${line("M32 56a28 28 0 0 1 36 0", 9)}${line("M43 69a13 13 0 0 1 14 0", 8)}</g><circle cx="50" cy="84" r="6"/>`),
  categorizedArt("crown-royal", "Royal Crown", "Symbols", `<path d="M50 14 66 40 88 16l-6 56H18L12 16l22 24z"/><rect x="16" y="78" width="68" height="10" rx="3"/>`),

  categorizedArt("helmet", "Football Helmet", "Sports", `<g>${line("M24 48a26 26 0 0 1 52 0v18H24z", 8)}${line("M76 52h14a9 9 0 0 1 0 18H62", 7)}${line("M44 48a8 8 0 1 0 0.1 0z", 6)}</g>`),
  categorizedArt("dumbbell", "Dumbbell", "Sports", `<path d="M8 40h9v20H8zM21 33h11v34H21zM68 33h11v34H68zM83 40h9v20h-9z"/><rect x="32" y="43" width="36" height="14" rx="2"/>`),
  categorizedArt("tennis", "Tennis Racket", "Sports", `<g>${line("M38 6a25 25 0 1 0 0.1 0z", 7)}${line("M24 22l28 28M52 22 24 50M38 6v50M12 32h52", 3)}${line("M56 58l28 32", 10)}</g>`),
  categorizedArt("golf", "Golf", "Sports", `<g>${line("M26 8v80", 7)}${line("M4 88h44", 6)}</g><path d="M28 10 66 22 28 34z"/><path d="M26 52c10-4 18-2 24 6" fill="none" stroke="#141414" stroke-width="5"/>`),
  categorizedArt("volleyball", "Volleyball", "Sports", `<g>${line("M50 8a42 42 0 1 0 0.1 0z", 6)}${line("M50 8c-12 12-17 29-13 48M50 8c12 12 17 29 13 48M14 38c16 7 40 7 58 0M22 74c11-13 25-21 43-23", 5)}</g>`),
  categorizedArt("boxing", "Boxing Glove", "Sports", `<g>${line("M30 16h24a20 20 0 0 1 20 20v10a18 18 0 0 1-18 18H30a14 14 0 0 1-14-14V30a14 14 0 0 1 14-14z", 8)}${line("M16 56h58", 7)}${line("M38 74h26a8 8 0 0 1 0 16H38a8 8 0 0 1 0-16z", 8)}</g>`),
  categorizedArt("skateboard", "Skateboard", "Sports", `<rect x="6" y="30" width="88" height="18" rx="9"/><circle cx="26" cy="68" r="11"/><circle cx="74" cy="68" r="11"/>`),
  categorizedArt("surfboard", "Surfboard", "Sports", `<path d="M50 4c12 14 18 30 18 46s-6 32-18 46c-12-14-18-30-18-46S38 18 50 4z"/><path d="M50 12v76" fill="none" stroke="#fff" stroke-width="3"/>`),
  categorizedArt("medal", "Medal", "Sports", `<path d="M30 6l12 26h16L70 6" fill="none" stroke="#141414" stroke-width="8"/><circle cx="50" cy="62" r="29"/><path d="M50 44l6 12 13 1-9 9 3 13-13-7-13 7 3-13-9-9 13-1z" fill="#fff"/>`),
  categorizedArt("bowling", "Bowling Ball", "Sports", `<path fill-rule="evenodd" d="M50 8a42 42 0 1 0 0.1 0z${hole(38, 34, 6)}${hole(60, 32, 6)}${hole(50, 52, 6)}"/>`),
  categorizedArt("runner", "Running", "Sports", `<g>${line("M52 16a8 8 0 1 0 0.1 0z", 6)}${line("M46 34l-6 22 14 8-8 20", 8)}${line("M40 56l-20 4M54 42l22-6M14 84l26-4M52 84h32", 6)}</g>`),

  categorizedArt("praying", "Praying Hands", "Faith", `<path d="M49 6C41 24 35 44 33 60c-2 12 1 24 7 30h9V26z"/><path d="M51 6c8 18 14 38 16 54 2 12-1 24-7 30h-9V26z"/>`),
  categorizedArt("angel-wings", "Angel Wings", "Faith", `<path d="M50 28c-7-11-21-17-36-14 7 10 6 23 15 29-9 0-16 4-20 10 13 7 28 7 41-2zM50 28c7-11 21-17 36-14-7 10-6 23-15 29 9 0 16 4 20 10-13 7-28 7-41-2z"/>`),
  categorizedArt("menorah", "Menorah", "Faith", `<g>${line("M8 82h84M50 82V26M26 82V46M74 82V46M38 82V38M62 82V38M50 26V14M40 14h20", 6)}</g><circle cx="50" cy="10" r="4"/>`),
  categorizedArt("star-david", "Star of David", "Faith", `${line("M50 8 82 64H18z", 7)}${line("M50 92 18 36h64z", 7)}`),
  categorizedArt("bible-heart", "Faith & Love", "Faith", `<path d="M50 24c-12-11-27-12-38-7v54c11-5 25-4 38 7 13-11 27-12 38-7V17c-11-5-26-4-38 7zM50 24v54" fill="none" stroke="#141414" stroke-width="6" stroke-linejoin="round"/><path d="M50 74C34 62 26 54 26 44a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 10-8 18-24 30z"/>`),
  categorizedArt("cross-rays", "Radiant Cross", "Faith", `<g>${spokes(8, 30, 46, 5, 22)}</g><path d="M40 6h20v30h30v20H60v38H40V56H10V36h30z"/>`),

  categorizedArt("tree", "Tree", "Nature", `<path d="M50 4 24 46h13L16 78h68L63 46h13z"/><rect x="44" y="76" width="12" height="20"/>`),
  categorizedArt("pine", "Pine Tree", "Nature", `<path d="M50 4 28 42h11L20 74h60L61 42h11z"/><rect x="44" y="72" width="12" height="22"/>`),
  categorizedArt("cactus", "Cactus", "Nature", `<rect x="38" y="18" width="24" height="76" rx="12"/><path d="M38 52H30a10 10 0 0 1-10-10V30h12v12h6zM62 60h8a10 10 0 0 0 10-10V36H68v14h-6z"/>`),
  categorizedArt("cloud", "Cloud", "Nature", `<path d="M28 76h46a18 18 0 0 0 1-36 25 25 0 0 0-48-3 17 17 0 0 0 1 39z"/>`),
  categorizedArt("rainbow", "Rainbow", "Nature", `<path fill-rule="evenodd" d="M4 80a46 46 0 0 1 92 0h-14a32 32 0 0 0-64 0zm26 0a20 20 0 0 1 40 0H56a6 6 0 0 0-12 0z"/>`),
  categorizedArt("snowflake", "Snowflake", "Nature", `<g>${spokes(6, 0, 42, 6)}${twigs(6, 28, 15, 5)}</g>`),
  categorizedArt("campfire", "Campfire", "Nature", `<path d="M50 6c12 18 24 26 24 42a24 24 0 0 1-48 0c0-9 5-16 11-23 1 7 4 12 9 15-3-14 0-24 4-34z"/><path d="M14 82h72" fill="none" stroke="#141414" stroke-width="8" stroke-linecap="round"/><path d="M24 72l52-8M24 64l52 8" fill="none" stroke="#141414" stroke-width="6" stroke-linecap="round"/>`),
  categorizedArt("palm-tree", "Palm Tree", "Nature", `<path d="M20 84c14-8 22-20 24-40" fill="none" stroke="#141414" stroke-width="10" stroke-linecap="round"/><path d="M44 44c-8-10-22-14-36-9 8-12 24-15 38-7 4-12 17-19 31-16-11 4-19 12-23 23 11-5 24-3 34 6-12 3-24 3-34-2-2 8-6 16-10 21z"/>`),
  categorizedArt("tent", "Camp Tent", "Nature", `<path d="M50 10 4 88h92z"/><path d="M50 10v78M50 44 34 88M50 44l16 44" fill="none" stroke="#fff" stroke-width="5"/>`),
  categorizedArt("sunset", "Sunset", "Nature", `<g>${line("M18 62a32 32 0 0 1 64 0", 7)}</g><rect x="2" y="60" width="96" height="8"/><path d="M12 76h76M22 88h56" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round"/>`),
  categorizedArt("bee", "Bee", "Nature", `<ellipse cx="50" cy="58" rx="17" ry="26"/><path d="M33 46h34M33 58h34M33 70h34" fill="none" stroke="#fff" stroke-width="5"/><path d="M40 30c-5-11-15-15-22-13 2 6 6 11 12 14M60 30c5-11 15-15 22-13-2 6-6 11-12 14" fill="none" stroke="#141414" stroke-width="5"/>`),
  categorizedArt("tulip", "Tulip", "Nature", `<path d="M26 26c0-13 11-22 24-22s24 9 24 22c0 15-11 26-24 26S26 41 26 26zM50 4v48" fill="#141414"/><path d="M50 52v42M50 66c-9-11-18-11-24-6 4 10 13 13 24 8M50 74c9-11 18-11 24-6-4 10-13 13-24 8" fill="none" stroke="#141414" stroke-width="6" stroke-linecap="round"/>`),
  categorizedArt("mountains-snow", "Snowy Peaks", "Nature", `<path d="M2 84 30 34l16 26 14-40 36 64z"/><path d="m24 46 6-12 7 12m14-16 7-18 9 20" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><path d="M6 92h88" fill="none" stroke="#141414" stroke-width="6" stroke-linecap="round"/>`),
  categorizedArt("island", "Island", "Nature", `<g>${line("M6 78h88", 6)}${line("M2 90c14-8 30-8 46 0s32 8 46 0", 6)}</g><circle cx="78" cy="24" r="11"/><path d="M40 78c4-8 8-14 12-18" fill="none" stroke="#141414" stroke-width="7" stroke-linecap="round"/><path d="M52 58c-6-8-16-11-26-7 6-9 17-11 27-5 3-8 12-13 22-11-8 3-13 9-16 17 8-4 17-2 24 5-9 2-18 2-25-2-1 6-4 11-6 14z"/>`),

  categorizedArt("tropical-fish", "Fish", "Animals", `<path d="M8 50c14-18 34-21 50-8l18-12-4 20 4 20-18-12c-16 13-36 10-50-8z"/><circle cx="30" cy="44" r="4" fill="#fff"/>${line("M36 40v20", 4)}`),
  categorizedArt("cat", "Cat", "Animals", `<path fill-rule="evenodd" d="M22 40 24 10l19 15h14l19-15 2 30v34a10 10 0 0 1-10 10H32a10 10 0 0 1-10-10z${hole(40, 46, 4)}${hole(60, 46, 4)}M50 60l-5 7h10z"/>`),
  categorizedArt("dog", "Dog", "Animals", `<path fill-rule="evenodd" d="M24 42c0-15 11-26 26-26 7 0 13 3 18 7l12-9v20c3 5 5 11 5 17v20a11 11 0 0 1-11 11H35a11 11 0 0 1-11-11z${hole(41, 43, 4)}M50 62c0 7 7 11 14 8"/>${line("M62 74h14", 5)}`),
  categorizedArt("dragonfly", "Dragonfly", "Animals", `<ellipse cx="30" cy="38" rx="21" ry="10"/><ellipse cx="70" cy="38" rx="21" ry="10"/><ellipse cx="32" cy="64" rx="17" ry="8"/><ellipse cx="68" cy="64" rx="17" ry="8"/><rect x="45" y="16" width="10" height="68" rx="5"/><circle cx="50" cy="14" r="8"/>`),
  categorizedArt("whale", "Whale", "Animals", `<path d="M6 52c14-15 36-17 55-6 13 7 25 7 35 0-2 13-11 23-23 27-17 6-42 2-59-9-5-3-8-7-8-12z"/><path d="M14 40c0-9 6-15 15-15" fill="none" stroke="#141414" stroke-width="6"/><circle cx="30" cy="46" r="3" fill="#fff"/>`),
  categorizedArt("paw-print", "Paw Print", "Animals", `<ellipse cx="50" cy="68" rx="25" ry="20"/><ellipse cx="19" cy="39" rx="9" ry="13" transform="rotate(-25 19 39)"/><ellipse cx="40" cy="24" rx="9" ry="13" transform="rotate(-10 40 24)"/><ellipse cx="62" cy="24" rx="9" ry="13" transform="rotate(10 62 24)"/><ellipse cx="82" cy="39" rx="9" ry="13" transform="rotate(25 82 39)"/>`),
  categorizedArt("butterfly-wing", "Butterflies", "Animals", `<path d="M46 44C36 12 6 2 8 26c1 16 16 25 33 28-18-1-26 10-20 20 8 14 26 2 33-16 7 18 25 30 33 16 6-10-2-21-20-20 17-3 32-12 33-28 2-24-28-14-38 18zM46 44v40" fill="none" stroke="#141414" stroke-width="6" stroke-linejoin="round"/><path d="M38 30 26 16M58 30 70 16" fill="none" stroke="#141414" stroke-width="5" stroke-linecap="round"/>`),
];
