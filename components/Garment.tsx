import type { ProductKind } from "@/lib/types";

interface GarmentProps {
  kind: ProductKind;
  color: string;
  /** Renders the back panel when true — hood, seams and pocket are omitted. */
  back?: boolean;
  className?: string;
  /** Decorative images carry no accessible name; labelled ones describe the product. */
  title?: string;
}

/**
 * Shade helpers. Derived from the garment colour so every colourway gets
 * consistent depth without a hand-authored gradient per product.
 */
function shades(hex: string) {
  const clean = hex.replace("#", "");
  const toInt = (i: number) => parseInt(clean.slice(i, i + 2), 16);
  const r = toInt(0);
  const g = toInt(2);
  const b = toInt(4);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const mix = (amount: number) => {
    const target = lum > 0.5 ? 0 : 255;
    const nr = Math.round(r + (target - r) * amount);
    const ng = Math.round(g + (target - g) * amount);
    const nb = Math.round(b + (target - b) * amount);
    return `#${[nr, ng, nb].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  return {
    light: mix(0.16),
    darker: mix(0.2),
    edge: mix(0.34),
    isLight: lum > 0.72,
  };
}

export default function Garment({
  kind,
  color,
  back = false,
  className,
  title,
}: GarmentProps) {
  const s = shades(color);
  const uid = `${kind}-${color.replace("#", "")}-${back ? "b" : "f"}`;
  const seam = s.isLight ? "rgba(20,20,20,0.16)" : "rgba(255,255,255,0.14)";
  const fold = s.isLight ? "rgba(20,20,20,0.09)" : "rgba(0,0,0,0.22)";

  const common = {
    className,
    viewBox: "0 0 320 340",
    xmlns: "http://www.w3.org/2000/svg",
    role: title ? ("img" as const) : ("presentation" as const),
    "aria-hidden": title ? undefined : true,
    "aria-label": title,
  };

  if (kind === "cap") {
    return (
      <svg {...common}>
        {title ? <title>{title}</title> : null}
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.light} />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <ellipse cx="160" cy="268" rx="104" ry="12" fill={fold} opacity="0.5" />
        <path
          d="M84 236c0-74 34-118 76-118s76 44 76 118z"
          fill={`url(#${uid}-g)`}
          stroke={seam}
          strokeWidth="1.5"
        />
        <path
          d="M160 118c22 0 40 20 47 48"
          fill="none"
          stroke={seam}
          strokeWidth="1.5"
        />
        <path d="M160 118v120" fill="none" stroke={seam} strokeWidth="1.5" />
        <path
          d="M84 236c26 8 66 12 76 12s50-4 76-12c14 12 8 26-16 28-30 3-90 3-120 0-24-2-30-16-16-28z"
          fill={s.darker}
          stroke={seam}
          strokeWidth="1.5"
        />
        {!back && <circle cx="160" cy="124" r="4" fill={s.edge} />}
      </svg>
    );
  }

  if (kind === "mug") {
    return (
      <svg {...common}>
        {title ? <title>{title}</title> : null}
        <defs>
          <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={s.darker} />
            <stop offset="0.28" stopColor={color} />
            <stop offset="0.72" stopColor={color} />
            <stop offset="1" stopColor={s.darker} />
          </linearGradient>
        </defs>
        <ellipse cx="152" cy="288" rx="76" ry="10" fill={fold} opacity="0.5" />
        <path
          d="M212 168c30-4 46 14 46 40s-18 42-48 40"
          fill="none"
          stroke={s.darker}
          strokeWidth="17"
          strokeLinecap="round"
        />
        <path
          d="M212 168c30-4 46 14 46 40s-18 42-48 40"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M74 108h164v148a22 22 0 0 1-22 22H96a22 22 0 0 1-22-22z"
          fill={`url(#${uid}-g)`}
          stroke={seam}
          strokeWidth="1.5"
        />
        <ellipse cx="156" cy="108" rx="82" ry="17" fill={s.light} stroke={seam} strokeWidth="1.5" />
        <ellipse cx="156" cy="108" rx="70" ry="12" fill={s.darker} opacity="0.55" />
      </svg>
    );
  }

  const isLong = kind === "longsleeve";
  const isHoodie = kind === "hoodie";
  const isCrew = kind === "crew";
  const sleeveBottom = isLong ? 300 : 268;

  return (
    <svg {...common}>
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.light} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={s.darker} />
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="326" rx="86" ry="9" fill={fold} opacity="0.45" />

      {/* sleeves */}
      <path
        d={
          isLong
            ? "M118 54 74 76 44 176c-4 14 6 22 18 20l20-4 4-40v146c0 8 4 12 12 12h124c8 0 12-4 12-12V152l4 40 20 4c12 2 22-6 18-20L246 76l-44-22z"
            : "M118 54 74 76 40 172c-4 14 6 22 18 20l22-4 6-44v158c0 8 4 12 12 12h124c8 0 12-4 12-12V144l6 44 22 4c12 2 22-6 18-20L246 76l-44-22z"
        }
        fill={`url(#${uid}-g)`}
        stroke={seam}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* shoulder / body shading */}
      <path
        d="M118 54 74 76l12 30c10-16 22-30 32-38z"
        fill={fold}
        opacity="0.5"
      />
      <path
        d="M202 54l44 22-12 30c-10-16-22-30-32-38z"
        fill={fold}
        opacity="0.5"
      />

      {/* neckline */}
      {isHoodie && !back && (
        <path
          d="M118 56c6 30 74 30 84 0 8 10 10 22 10 30-30 16-74 16-104 0 0-8 2-20 10-30z"
          fill={s.darker}
          stroke={seam}
          strokeWidth="1.5"
        />
      )}
      {(isCrew || !isHoodie) && (
        <path
          d={
            back
              ? "M120 54c8 26 72 26 80 0"
              : "M120 55c8 26 72 26 80 0"
          }
          fill="none"
          stroke={seam}
          strokeWidth="7"
          strokeLinecap="round"
        />
      )}

      {/* hood behind the shoulders */}
      {isHoodie && (
        <path
          d="M118 56c0-16 18-28 42-28s42 12 42 28c0 22-18 34-42 34s-42-12-42-34z"
          fill={s.darker}
          stroke={seam}
          strokeWidth="1.5"
          opacity={back ? 0.9 : 0.55}
        />
      )}

      {/* side seams */}
      <path d="M108 148v170" fill="none" stroke={seam} strokeWidth="1.2" opacity="0.7" />
      <path d="M212 148v170" fill="none" stroke={seam} strokeWidth="1.2" opacity="0.7" />

      {/* pocket */}
      {isHoodie && !back && (
        <path
          d="M112 232h96v46a10 10 0 0 1-10 10h-76a10 10 0 0 1-10-10z"
          fill={s.darker}
          stroke={seam}
          strokeWidth="1.5"
        />
      )}

      {/* hem and cuffs */}
      <path
        d={`M104 ${sleeveBottom}h112`}
        stroke={seam}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {isLong && (
        <>
          <path d="M62 202h22" stroke={seam} strokeWidth="5" strokeLinecap="round" />
          <path d="M236 202h22" stroke={seam} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {/* fabric folds */}
      <path d="M130 150v168" fill="none" stroke={fold} strokeWidth="1.2" opacity="0.6" />
      <path d="M190 150v168" fill="none" stroke={fold} strokeWidth="1.2" opacity="0.6" />
    </svg>
  );
}