import type { TextLayer } from "@/lib/types";

export type TemplateCategory = "Team & Sports" | "Faith" | "Nature" | "Classic" | "Celebration" | "School & Work";

export const TEMPLATE_CATEGORIES = ["All", "Team & Sports", "Faith", "Nature", "Classic", "Celebration", "School & Work"] as const;

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
  template("volley-club", "Volley Club", "Team & Sports", "Serve with heart", "volleyball", ["volleyball", "team", "serve"], [
    { type: "text", layer: title("VOLLEY CLUB", 30, 10, "#C94F37", -7) },
    { type: "art", layer: art("volleyball", 52, 0.29) },
    { type: "text", layer: caption("SERVE WITH HEART", 77) },
  ]),
  template("diamond-season", "Diamond Season", "Team & Sports", "Play every inning", "baseball", ["baseball", "team", "season"], [
    { type: "art", layer: art("baseball", 38, 0.25) },
    { type: "text", layer: title("DIAMOND SEASON", 66, 8, "#285B43") },
    { type: "text", layer: caption("PLAY EVERY INNING", 77) },
  ]),
  template("court-crew", "Court Crew", "Team & Sports", "Make your move", "tennis", ["tennis", "court", "team"], [
    { type: "text", layer: title("COURT CREW", 31, 11, "#3E6A50", 6) },
    { type: "art", layer: art("tennis", 53, 0.26) },
    { type: "text", layer: caption("MAKE YOUR MOVE", 77) },
  ]),
  template("coach-mode", "Coach Mode", "Team & Sports", "Lead the team", "whistle", ["coach", "team", "sports"], [
    { type: "art", layer: art("whistle", 40, 0.3) },
    { type: "text", layer: title("COACH MODE", 67, 11, "#1D5B9B") },
    { type: "text", layer: caption("LEAD THE TEAM", 78) },
  ]),
  template("walk-in-love", "Walk in Love", "Faith", "Choose kindness", "heart", ["faith", "love", "kindness"], [
    { type: "art", layer: art("heart", 39, 0.28) },
    { type: "text", layer: title("WALK IN LOVE", 67, 10, "#A33D58") },
    { type: "text", layer: caption("CHOOSE KINDNESS", 78) },
  ]),
  template("made-new", "Made New", "Faith", "Hope lives here", "dove", ["faith", "hope", "new"], [
    { type: "text", layer: title("MADE NEW", 31, 12, "#46734B", -8) },
    { type: "art", layer: art("dove", 53, 0.28) },
    { type: "text", layer: caption("HOPE LIVES HERE", 78) },
  ]),
  template("prayer-and-praise", "Prayer & Praise", "Faith", "Keep the faith", "prayer-hands", ["faith", "prayer", "praise"], [
    { type: "art", layer: art("prayer-hands", 39, 0.28) },
    { type: "text", layer: title("PRAYER & PRAISE", 68, 9, "#5B477D") },
    { type: "text", layer: caption("KEEP THE FAITH", 79) },
  ]),
  template("wild-and-free", "Wild & Free", "Nature", "Find your trail", "mountains", ["nature", "trail", "adventure"], [
    { type: "text", layer: title("WILD & FREE", 31, 11, "#315B45", -5) },
    { type: "art", layer: art("mountains", 53, 0.29) },
    { type: "text", layer: caption("FIND YOUR TRAIL", 78) },
  ]),
  template("desert-bloom", "Desert Bloom", "Nature", "Grow your own way", "cactus", ["nature", "desert", "growth"], [
    { type: "art", layer: art("cactus", 39, 0.28) },
    { type: "text", layer: title("DESERT BLOOM", 68, 10, "#C8753C") },
    { type: "text", layer: caption("GROW YOUR OWN WAY", 79) },
  ]),
  template("moonlight-club", "Moonlight Club", "Nature", "Meet me outside", "moon", ["nature", "moon", "night"], [
    { type: "text", layer: title("MOONLIGHT CLUB", 31, 9, "#566189", 5) },
    { type: "art", layer: art("moon", 53, 0.28) },
    { type: "text", layer: caption("MEET ME OUTSIDE", 78) },
  ]),
  template("built-different", "Built Different", "Classic", "Own your story", "infinity", ["classic", "statement", "bold"], [
    { type: "art", layer: art("infinity", 40, 0.31) },
    { type: "text", layer: title("BUILT DIFFERENT", 68, 9) },
    { type: "text", layer: caption("OWN YOUR STORY", 79) },
  ]),
  template("good-company", "Good Company", "Classic", "Better together", "laurel", ["classic", "friends", "together"], [
    { type: "text", layer: title("GOOD COMPANY", 31, 10, "#476248", -5) },
    { type: "art", layer: art("laurel", 53, 0.28) },
    { type: "text", layer: caption("BETTER TOGETHER", 78) },
  ]),
  template("find-your-north", "Find Your North", "Classic", "Keep moving forward", "compass", ["classic", "compass", "direction"], [
    { type: "art", layer: art("compass", 39, 0.27) },
    { type: "text", layer: title("FIND YOUR NORTH", 68, 9, "#2B5B76") },
    { type: "text", layer: caption("KEEP MOVING FORWARD", 79) },
  ]),
  template("birthday-club", "Birthday Club", "Celebration", "Make a wish", "party-hat", ["birthday", "party", "celebration"], [
    { type: "text", layer: title("BIRTHDAY CLUB", 31, 10, "#C04C7A", -6) },
    { type: "art", layer: art("party-hat", 53, 0.25) },
    { type: "text", layer: caption("MAKE A WISH", 78) },
  ]),
  template("made-to-celebrate", "Made to Celebrate", "Celebration", "Bring the good times", "fireworks", ["celebration", "party", "fireworks"], [
    { type: "art", layer: art("fireworks", 39, 0.29) },
    { type: "text", layer: title("LET'S CELEBRATE", 68, 9, "#B34A43") },
    { type: "text", layer: caption("BRING THE GOOD TIMES", 79) },
  ]),
  template("little-surprise", "Little Surprise", "Celebration", "Wrapped with joy", "gift", ["gift", "celebration", "joy"], [
    { type: "text", layer: title("A LITTLE SURPRISE", 31, 9, "#795798", 5) },
    { type: "art", layer: art("gift", 53, 0.29) },
    { type: "text", layer: caption("WRAPPED WITH JOY", 78) },
  ]),
  template("class-crew", "Class Crew", "School & Work", "Learn together", "graduation-cap", ["school", "class", "graduation"], [
    { type: "art", layer: art("graduation-cap", 39, 0.3) },
    { type: "text", layer: title("CLASS CREW", 68, 11, "#315C8B") },
    { type: "text", layer: caption("LEARN TOGETHER", 79) },
  ]),
  template("book-club", "Book Club", "School & Work", "One more chapter", "open-book", ["school", "book", "reading"], [
    { type: "text", layer: title("BOOK CLUB", 31, 12, "#6D4A38", -5) },
    { type: "art", layer: art("open-book", 53, 0.3) },
    { type: "text", layer: caption("ONE MORE CHAPTER", 78) },
  ]),
  template("bright-ideas", "Bright Ideas", "School & Work", "Think big", "lightbulb", ["school", "ideas", "creative"], [
    { type: "art", layer: art("lightbulb", 39, 0.27) },
    { type: "text", layer: title("BRIGHT IDEAS", 68, 10, "#D77724") },
    { type: "text", layer: caption("THINK BIG", 79) },
  ]),
];
