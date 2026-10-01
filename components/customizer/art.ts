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
];
