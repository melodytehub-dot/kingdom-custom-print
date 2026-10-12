import type { TextLayer } from "@/lib/types";

export type TemplateCategory = "Team & Sports" | "Faith" | "Nature" | "Classic";

export const TEMPLATE_CATEGORIES = ["All", "Team & Sports", "Faith", "Nature", "Classic"] as const;

type TemplateText = Pick<
  TextLayer,
  | "text"
  | "font"
  | "fontSize"
  | "color"
  | "weight"
  | "uppercase"
  | "align"
  | "letterSpacing"
  | "lineHeight"
  | "strokeColor"
  | "strokeWidth"
  | "arc"
> & { x: number; y: number };

type TemplateArt = {
  artId: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};

export interface DesignTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  subtitle: string;
  tags: string[];
  artId: string;
  elements: Array<{ type: "text"; layer: TemplateText } | { type: "art"; layer: TemplateArt }>;
}

const title = (text: string, y: number, fontSize = 11, color = "#141414", arc = 0): TemplateText => ({
  text,
  x: 50,
  y,
  font: "anton",
  fontSize,
  color,
  weight: 900,
  uppercase: true,
  align: "center",
  letterSpacing: 0.3,
  lineHeight: 1,
  strokeColor: "#FFFFFF",
  strokeWidth: 0,
  arc,
});

const caption = (text: string, y: number, color = "#3F4650"): TemplateText => ({
  ...title(text, y, 4.5, color),
  font: "montserrat",
  weight: 700,
  letterSpacing: 1,
});

const art = (artId: string, y: number, scale = 0.3): TemplateArt => ({
  artId,
  x: 50,
  y,
  scaleX: scale,
  scaleY: scale,
});

const template = (
  id: string,
  name: string,
  category: TemplateCategory,
  subtitle: string,
  artId: string,
  tags: string[],
  elements: DesignTemplate["elements"],
): DesignTemplate => ({ id, name, category, subtitle, artId, tags, elements });

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  template("team-captain", "Team Captain", "Team & Sports", "Lead with pride", "trophy", ["team", "sport", "captain"], [
    { type: "art", layer: art("trophy", 38, 0.28) },
    { type: "text", layer: title("TEAM CAPTAIN", 67, 9) },
    { type: "text", layer: caption("LEAD WITH PRIDE", 77) },
  ]),
  template("game-day", "Game Day", "Team & Sports", "Bring your best", "basketball", ["team", "sport", "basketball"], [
    { type: "text", layer: title("GAME DAY", 32, 12, "#D64A32", -8) },
    { type: "art", layer: art("basketball", 52, 0.28) },
    { type: "text", layer: caption("BRING YOUR BEST", 76) },
  ]),
  template("all-star", "All Star", "Team & Sports", "Play with heart", "star", ["team", "sport", "star"], [
    { type: "art", layer: art("star", 39, 0.3) },
    { type: "text", layer: title("ALL STAR", 64, 12, "#1D5B9B") },
    { type: "text", layer: caption("PLAY WITH HEART", 75) },
  ]),
  template("champions", "Champions", "Team & Sports", "Earned together", "trophy", ["team", "sport", "winner"], [
    { type: "text", layer: title("CHAMPIONS", 31, 11, "#BA8B25", 8) },
    { type: "art", layer: art("trophy", 53, 0.27) },
    { type: "text", layer: caption("EARNED TOGETHER", 77) },
  ]),
  template("faith-over-fear", "Faith Over Fear", "Faith", "Walk by faith", "cross", ["faith", "church", "hope"], [
    { type: "art", layer: art("cross", 39, 0.24) },
    { type: "text", layer: title("FAITH OVER FEAR", 63, 9) },
    { type: "text", layer: caption("WALK BY FAITH", 75, "#6B4C35") },
  ]),
  template("grace", "Grow in Grace", "Faith", "Rooted in hope", "flower", ["faith", "flower", "hope"], [
    { type: "art", layer: art("flower", 40, 0.27) },
    { type: "text", layer: title("GROW IN GRACE", 68, 10, "#47734B") },
    { type: "text", layer: caption("ROOTED IN HOPE", 78) },
  ]),
  template("wildflower", "Wildflower", "Nature", "Stay curious", "flower", ["nature", "flower", "garden"], [
    { type: "text", layer: title("WILD AT HEART", 31, 10, "#C45468", -7) },
    { type: "art", layer: art("flower", 53, 0.28) },
    { type: "text", layer: caption("STAY CURIOUS", 77) },
  ]),
  template("ocean-club", "Ocean Club", "Nature", "Find your horizon", "wave", ["nature", "ocean", "summer"], [
    { type: "art", layer: art("wave", 41, 0.3) },
    { type: "text", layer: title("OCEAN CLUB", 67, 11, "#176A83") },
    { type: "text", layer: caption("FIND YOUR HORIZON", 77) },
  ]),
  template("crowned", "Crowned", "Classic", "Kingdom originals", "crown", ["classic", "crown", "kingdom"], [
    { type: "art", layer: art("crown", 39, 0.26) },
    { type: "text", layer: title("KINGDOM", 65, 12) },
    { type: "text", layer: caption("CUSTOM PRINT", 76) },
  ]),
  template("good-vibes", "Good Vibes", "Classic", "Keep it bright", "sun", ["classic", "sun", "positive"], [
    { type: "art", layer: art("sun", 39, 0.28) },
    { type: "text", layer: title("GOOD VIBES", 67, 11, "#D77724") },
    { type: "text", layer: caption("KEEP IT BRIGHT", 77) },
  ]),
];
