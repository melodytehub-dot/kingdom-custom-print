import type { TextLayer } from "@/lib/types";

export type TemplateCategory =
  | "Team & Sports"
  | "Faith"
  | "Nature"
  | "Classic"
  | "Business"
  | "Events & Celebrations"
  | "Holidays"
  | "Pets";

export const TEMPLATE_CATEGORIES = [
  "All",
  "Team & Sports",
  "Faith",
  "Nature",
  "Classic",
  "Business",
  "Events & Celebrations",
  "Holidays",
  "Pets",
] as const;

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

  /* ---- Team & Sports ---- */
  template("victory-lane", "Victory Lane", "Team & Sports", "Earned it", "medal", ["team", "sport", "winner", "medal"], [
    { type: "art", layer: art("medal", 37, 0.3) },
    { type: "text", layer: title("VICTORY LANE", 68, 10, "#BA8B25") },
    { type: "text", layer: caption("EARNED IT", 78) },
  ]),
  template("home-run", "Home Run", "Team & Sports", "Swing big", "baseball", ["team", "sport", "baseball"], [
    { type: "text", layer: title("HOME RUN", 31, 12, "#1D5B9B", -6) },
    { type: "art", layer: art("baseball", 53, 0.28) },
    { type: "text", layer: caption("SWING BIG", 77) },
  ]),
  template("slam-dunk", "Slam Dunk", "Team & Sports", "Above the rim", "basketball", ["team", "sport", "basketball"], [
    { type: "art", layer: art("basketball", 38, 0.3) },
    { type: "text", layer: title("SLAM DUNK", 67, 11, "#D64A32") },
    { type: "text", layer: caption("ABOVE THE RIM", 77) },
  ]),
  template("gridiron", "Gridiron", "Team & Sports", "Game on", "helmet", ["team", "sport", "football"], [
    { type: "art", layer: art("helmet", 38, 0.3) },
    { type: "text", layer: title("GRIDIRON", 67, 11) },
    { type: "text", layer: caption("GAME ON", 77) },
  ]),
  template("fight-song", "Fight Song", "Team & Sports", "One team", "soccer", ["team", "sport", "soccer"], [
    { type: "text", layer: title("FIGHT SONG", 31, 11, "#2C7A4B", 6) },
    { type: "art", layer: art("soccer", 53, 0.28) },
    { type: "text", layer: caption("ONE TEAM", 77) },
  ]),
  template("iron-will", "Iron Will", "Team & Sports", "Train hard", "dumbbell", ["team", "gym", "fitness"], [
    { type: "art", layer: art("dumbbell", 38, 0.32) },
    { type: "text", layer: title("IRON WILL", 67, 12) },
    { type: "text", layer: caption("TRAIN HARD", 77) },
  ]),

  /* ---- Faith ---- */
  template("blessed", "Blessed", "Faith", "And grateful", "dove", ["faith", "dove", "blessed"], [
    { type: "art", layer: art("dove", 38, 0.3) },
    { type: "text", layer: title("BLESSED", 68, 12) },
    { type: "text", layer: caption("AND GRATEFUL", 78) },
  ]),
  template("pray-bold", "Pray Bold", "Faith", "Trust His plan", "praying", ["faith", "prayer", "hope"], [
    { type: "art", layer: art("praying", 37, 0.28) },
    { type: "text", layer: title("PRAY BOLD", 68, 11, "#6B4C35") },
    { type: "text", layer: caption("TRUST HIS PLAN", 78) },
  ]),
  template("mountain-mover", "Mountain Mover", "Faith", "Faith that shifts", "mountains-snow", ["faith", "mountains", "hope"], [
    { type: "text", layer: title("MOUNTAIN MOVER", 28, 9, "#2C5D7A") },
    { type: "art", layer: art("mountains-snow", 52, 0.34) },
    { type: "text", layer: caption("FAITH THAT SHIFTS", 79) },
  ]),
  template("rooted", "Rooted", "Faith", "Grounded in grace", "tree", ["faith", "tree", "grace"], [
    { type: "art", layer: art("tree", 38, 0.3) },
    { type: "text", layer: title("ROOTED", 68, 12, "#47734B") },
    { type: "text", layer: caption("IN FAITH", 78) },
  ]),
  template("guiding-light", "Guiding Light", "Faith", "Walk in faith", "cross-rays", ["faith", "cross", "light"], [
    { type: "art", layer: art("cross-rays", 38, 0.28) },
    { type: "text", layer: title("GUIDING LIGHT", 68, 10) },
    { type: "text", layer: caption("WALK IN FAITH", 78) },
  ]),

  /* ---- Nature ---- */
  template("adventure-awaits", "Adventure Awaits", "Nature", "Find your trail", "map-pin", ["nature", "travel", "outdoors"], [
    { type: "art", layer: art("map-pin", 37, 0.3) },
    { type: "text", layer: title("ADVENTURE AWAITS", 67, 9, "#2F5D3A") },
    { type: "text", layer: caption("FIND YOUR TRAIL", 77) },
  ]),
  template("camp-life", "Camp Life", "Nature", "The best days", "campfire", ["nature", "camp", "outdoors"], [
    { type: "text", layer: title("CAMP LIFE", 30, 12, "#C4642A", -6) },
    { type: "art", layer: art("campfire", 53, 0.3) },
    { type: "text", layer: caption("THE BEST DAYS", 78) },
  ]),
  template("wilderness", "The Wilderness", "Nature", "Explore more", "pine", ["nature", "forest", "outdoors"], [
    { type: "art", layer: art("pine", 38, 0.3) },
    { type: "text", layer: title("THE WILDERNESS", 68, 10, "#1F4D3A") },
    { type: "text", layer: caption("EXPLORE MORE", 78) },
  ]),
  template("desert-bloom", "Desert Bloom", "Nature", "Grow anywhere", "cactus", ["nature", "desert", "plants"], [
    { type: "art", layer: art("cactus", 38, 0.28) },
    { type: "text", layer: title("DESERT BLOOM", 68, 10, "#6E7A3A") },
    { type: "text", layer: caption("GROW ANYWHERE", 78) },
  ]),
  template("sunset-chaser", "Sunset Chaser", "Nature", "Golden hour", "sunset", ["nature", "sunset", "summer"], [
    { type: "art", layer: art("sunset", 43, 0.36) },
    { type: "text", layer: title("SUNSET CHASER", 72, 10, "#D77724") },
    { type: "text", layer: caption("GOLDEN HOUR", 81) },
  ]),
  template("snow-day", "Snow Day", "Nature", "Winter vibes", "snowflake", ["nature", "winter", "snow"], [
    { type: "art", layer: art("snowflake", 38, 0.3) },
    { type: "text", layer: title("SNOW DAY", 68, 12, "#3E7CB1") },
    { type: "text", layer: caption("WINTER VIBES", 78) },
  ]),

  /* ---- Classic ---- */
  template("kingdom-co", "Kingdom Co.", "Classic", "Since day one", "crown-royal", ["classic", "crown", "kingdom"], [
    { type: "art", layer: art("crown-royal", 37, 0.3) },
    { type: "text", layer: title("KINGDOM CO.", 68, 11) },
    { type: "text", layer: caption("SINCE DAY ONE", 78) },
  ]),
  template("retro-star", "Retro Star", "Classic", "Good vibes only", "sparkle", ["classic", "retro", "star"], [
    { type: "text", layer: title("RETRO", 31, 13, "#C45468", 8) },
    { type: "art", layer: art("sparkle", 53, 0.28) },
    { type: "text", layer: caption("GOOD VIBES ONLY", 78) },
  ]),
  template("bold-move", "Bold Move", "Classic", "Make it count", "bolt", ["classic", "bold", "energy"], [
    { type: "art", layer: art("bolt", 38, 0.3) },
    { type: "text", layer: title("BOLD MOVE", 68, 12, "#BA8B25") },
    { type: "text", layer: caption("MAKE IT COUNT", 78) },
  ]),

  /* ---- Business ---- */
  template("company-team", "Company Team", "Business", "Est. 2024", "gear", ["business", "team", "company"], [
    { type: "art", layer: art("gear", 38, 0.3) },
    { type: "text", layer: title("COMPANY TEAM", 68, 10) },
    { type: "text", layer: caption("EST. 2024", 78) },
  ]),
  template("open-for-business", "Open For Business", "Business", "Come say hi", "speech", ["business", "shop", "small business"], [
    { type: "art", layer: art("speech", 38, 0.3) },
    { type: "text", layer: title("OPEN FOR BUSINESS", 68, 9, "#1D5B9B") },
    { type: "text", layer: caption("COME SAY HI", 78) },
  ]),
  template("grand-opening", "Grand Opening", "Business", "Now hiring", "banner", ["business", "event", "grand opening"], [
    { type: "art", layer: art("banner", 33, 0.4) },
    { type: "text", layer: title("GRAND OPENING", 60, 10, "#B33B24") },
    { type: "text", layer: caption("NOW HIRING", 70) },
  ]),
  template("logo-ready", "Logo Ready", "Business", "You name it", "shield-check", ["business", "logo", "brand"], [
    { type: "art", layer: art("shield-check", 38, 0.3) },
    { type: "text", layer: title("YOU NAME IT", 68, 11) },
    { type: "text", layer: caption("WE PRINT IT", 78) },
  ]),

  /* ---- Events & Celebrations ---- */
  template("birthday-bash", "Birthday Bash", "Events & Celebrations", "Let's celebrate", "sparkles", ["birthday", "party", "celebration"], [
    { type: "art", layer: art("sparkles", 37, 0.3) },
    { type: "text", layer: title("BIRTHDAY BASH", 68, 10, "#C45468") },
    { type: "text", layer: caption("LET'S CELEBRATE", 78) },
  ]),
  template("party-crew", "Party Crew", "Events & Celebrations", "All night", "burst", ["party", "celebration", "crew"], [
    { type: "art", layer: art("burst", 38, 0.32) },
    { type: "text", layer: title("PARTY CREW", 68, 12, "#7B3FA0") },
    { type: "text", layer: caption("ALL NIGHT", 78) },
  ]),
  template("game-night", "Game Night", "Events & Celebrations", "Play to win", "controller", ["party", "games", "night"], [
    { type: "art", layer: art("controller", 38, 0.3) },
    { type: "text", layer: title("GAME NIGHT", 68, 11, "#2C7A4B") },
    { type: "text", layer: caption("PLAY TO WIN", 78) },
  ]),
  template("family-reunion", "Family Reunion", "Events & Celebrations", "Together again", "heart", ["family", "reunion", "celebration"], [
    { type: "art", layer: art("heart", 37, 0.28) },
    { type: "text", layer: title("FAMILY REUNION", 68, 10, "#B33B24") },
    { type: "text", layer: caption("TOGETHER AGAIN", 78) },
  ]),

  /* ---- Holidays ---- */
  template("spooky-season", "Spooky Season", "Holidays", "Stay weird", "skull", ["halloween", "holiday", "spooky"], [
    { type: "art", layer: art("skull", 38, 0.3) },
    { type: "text", layer: title("SPOOKY SEASON", 68, 10, "#7B3FA0") },
    { type: "text", layer: caption("STAY WEIRD", 78) },
  ]),
  template("merry-bright", "Merry & Bright", "Holidays", "Holiday cheer", "snowflake", ["christmas", "holiday", "winter"], [
    { type: "art", layer: art("snowflake", 37, 0.3) },
    { type: "text", layer: title("MERRY & BRIGHT", 68, 10, "#B33B24") },
    { type: "text", layer: caption("HOLIDAY CHEER", 78) },
  ]),
  template("harvest-days", "Harvest Days", "Holidays", "Thankful heart", "leaf", ["thanksgiving", "holiday", "fall"], [
    { type: "art", layer: art("leaf", 38, 0.3) },
    { type: "text", layer: title("HARVEST DAYS", 68, 11, "#C4642A") },
    { type: "text", layer: caption("THANKFUL HEART", 78) },
  ]),

  /* ---- Pets ---- */
  template("puppy-love", "Puppy Love", "Pets", "Best friend", "paw-print", ["pets", "dog", "paw"], [
    { type: "art", layer: art("paw-print", 38, 0.3) },
    { type: "text", layer: title("PUPPY LOVE", 68, 11, "#8A5A2B") },
    { type: "text", layer: caption("BEST FRIEND", 78) },
  ]),
  template("cat-life", "Cat Life", "Pets", "Meow mode", "cat", ["pets", "cat", "funny"], [
    { type: "art", layer: art("cat", 37, 0.3) },
    { type: "text", layer: title("CAT LIFE", 68, 12, "#3F4650") },
    { type: "text", layer: caption("MEOW MODE", 78) },
  ]),
  template("good-boy-club", "Good Boy Club", "Pets", "Woof", "dog", ["pets", "dog", "club"], [
    { type: "art", layer: art("dog", 37, 0.3) },
    { type: "text", layer: title("GOOD BOY CLUB", 68, 10, "#1D5B9B") },
    { type: "text", layer: caption("WOOF", 78) },
  ]),
];
