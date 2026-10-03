import type { ReactNode } from "react";

/** Icon set for the design studio. All icons inherit `currentColor`. */

function Svg({
  children,
  size,
  fill = "none",
  stroke = true,
}: {
  children: ReactNode;
  size?: number;
  fill?: string;
  stroke?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke={stroke ? "currentColor" : "none"}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

export const HeadsetIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4.5 13v-1.5a7.5 7.5 0 0 1 15 0V13" />
    <rect x="3" y="12.5" width="3.8" height="6" rx="1.6" />
    <rect x="17.2" y="12.5" width="3.8" height="6" rx="1.6" />
    <path d="M19 18.5c0 1.8-1.6 2.7-4 2.7h-1.6" />
    <circle cx="12.6" cy="21.2" r="0.9" />
  </Svg>
);

export const SaveIcon = ({ size }: P) => (
  <Svg size={size} fill="currentColor" stroke={false}>
    <path d="M5 3h11.2L21 7.8V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 1.5V9h7V4.5H7Zm5 7.4a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z" />
  </Svg>
);

export const DollarIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 2.5v19" />
    <path d="M17 7c0-1.9-2.2-3.2-5-3.2S7 5.1 7 7.1c0 4.2 10 2.1 10 6.5 0 2-2.2 3.4-5 3.4s-5-1.4-5-3.4" />
  </Svg>
);

export const ShirtIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M8.5 3.5 3 6l1.6 5 3-.9V20.5h8.8V10.1l3 .9L21 6l-5.5-2.5a3.6 3.6 0 0 1-7 0Z" />
  </Svg>
);

export const TextBoxIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3.5 5.5h4M5.5 5.5v13M3.5 18.5h4" />
    <rect x="9.5" y="8.5" width="11" height="7" rx="1.6" />
  </Svg>
);

export const CloudUploadIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M7.5 17.5h-1a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 16.6 8.6 4.5 4.5 0 0 1 17 17.5h-1" />
    <path d="M12 21v-8m0 0-3 3m3-3 3 3" />
  </Svg>
);

export const AiArtIcon = ({ size }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="ai-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3b82f6" />
        <stop offset="1" stopColor="#a855f7" />
      </linearGradient>
    </defs>
    <rect
      x="4"
      y="6"
      width="16"
      height="15"
      rx="2.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <text
      x="12"
      y="17.2"
      textAnchor="middle"
      fontSize="8.6"
      fontWeight="800"
      fill="url(#ai-grad)"
      fontFamily="Inter, Arial, sans-serif"
    >
      AI
    </text>
    <path
      d="M5.5 1.8l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6zM10.5 2.8l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z"
      fill="url(#ai-grad)"
    />
  </svg>
);

export const PersonalizeIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20.5l1.5-4.8A8.5 8.5 0 1 1 21 11.5Z" />
    <text
      x="12.5"
      y="14.6"
      textAnchor="middle"
      fontSize="8.4"
      fontWeight="800"
      fill="currentColor"
      stroke="none"
      fontFamily="Inter, Arial, sans-serif"
    >
      12
    </text>
  </Svg>
);

export const UserIcon = ({ size }: P) => (
  <Svg size={size} fill="currentColor" stroke={false}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Zm0 13.1a8 8 0 0 1-6-2.7c.3-2 3-3.1 6-3.1s5.7 1.1 6 3.1a8 8 0 0 1-6 2.7Z" />
  </Svg>
);

export const DistressIcon = ({ size }: P) => (
  <Svg size={size} fill="currentColor" stroke={false}>
    {[
      [3, 3, 3],
      [8, 3, 2],
      [14, 2.5, 3],
      [19, 4, 2],
      [4, 8, 2],
      [10, 7.5, 3],
      [17, 8.5, 2.5],
      [21, 8, 1.5],
      [3, 13.5, 3],
      [8.5, 12.5, 2],
      [13.5, 13, 3],
      [19, 13, 3],
      [5, 18.5, 2],
      [10, 18, 3],
      [16, 18.5, 2],
      [20.5, 19, 2],
    ].map(([x, y, s], i) => (
      <rect key={i} x={x} y={y} width={s} height={s} rx={0.5} />
    ))}
  </Svg>
);

export const ShareIcon = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="18" cy="5" r="2.6" />
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="19" r="2.6" />
    <path d="m8.3 10.7 7.4-4.4M8.3 13.3l7.4 4.4" />
  </Svg>
);

export const UndoIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 7H5v4" />
    <path d="M5 11a8 8 0 1 1 2.4 7" />
  </Svg>
);

export const RedoIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M15 7h4v4" />
    <path d="M19 11a8 8 0 1 0-2.4 7" />
  </Svg>
);

export const CenterIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3v18" strokeDasharray="2 2.4" />
    <path d="M3.5 12 9 8.5v7zM20.5 12 15 8.5v7z" />
  </Svg>
);

export const LayerBackIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="m12 3.5 8.5 4.6-8.5 4.6-8.5-4.6z" />
    <path d="m3.5 12.2 8.5 4.6 8.5-4.6" />
    <path d="m3.5 16.3 8.5 4.6 8.5-4.6" />
  </Svg>
);

export const LayerFrontIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="m12 3.5 8.5 4.6-8.5 4.6-8.5-4.6z" />
    <path d="m3.5 12.2 8.5 4.6 8.5-4.6" />
  </Svg>
);

export const FlipHIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3v18" strokeDasharray="2 2.4" />
    <path d="M9.5 7 4 12l5.5 5zM14.5 7 20 12l-5.5 5z" />
  </Svg>
);

export const FlipVIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 12h18" strokeDasharray="2 2.4" />
    <path d="M7 9.5 12 4l5 5.5zM7 14.5 12 20l5-5.5z" />
  </Svg>
);

export const LockIcon = ({ size, open }: P & { open?: boolean }) => (
  <Svg size={size}>
    <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.4" />
    <path d={open ? "M8 10.5V7.5a4 4 0 0 1 7.6-1.7" : "M8 10.5V7.5a4 4 0 0 1 8 0v3"} />
    <circle cx="12" cy="15.5" r="1.4" />
  </Svg>
);

export const DuplicateIcon = ({ size }: P) => (
  <Svg size={size}>
    <rect x="9" y="9" width="11.5" height="11.5" rx="2.2" />
    <path d="M15 6.5V5.2A1.7 1.7 0 0 0 13.3 3.5H5.2A1.7 1.7 0 0 0 3.5 5.2v8.1a1.7 1.7 0 0 0 1.7 1.7h1.3" />
    <path d="M14.75 12.5v5M12.25 15h5" />
  </Svg>
);

export const TrashIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 13.5h10l1-13.5M10 10.5v6M14 10.5v6" />
  </Svg>
);

export const CloseIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
  </Svg>
);

export const ChevronRightIcon = ({ size }: P) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const BackArrowIcon = ({ size }: P) => (
  <Svg size={size}>
    <path d="M15 5.5 8.5 12l6.5 6.5" />
  </Svg>
);

export const CartGlyph = ({ size }: P) => (
  <Svg size={size}>
    <path d="M3 4h2.4l2.1 11h10.2l2-8H6.2" />
    <circle cx="9" cy="19.5" r="1.3" />
    <circle cx="17" cy="19.5" r="1.3" />
  </Svg>
);

export const CheckGlyph = ({ size }: P) => (
  <Svg size={size}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const PlusGlyph = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusGlyph = ({ size }: P) => (
  <Svg size={size}>
    <path d="M5 12h14" />
  </Svg>
);

export const SlashSwatch = () => (
  <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true" focusable="false">
    <path d="M6 34 34 6" stroke="#e5383b" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** The big "rotate" shirt with blue arrows shown at the stage's top right. */
export const RotateShirtIcon = () => (
  <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" focusable="false">
    <path
      d="M22 6 11.5 11 8 21l7 2.6V40h34V23.6L56 21 52.5 11 42 6a10 10 0 0 1-20 0Z"
      fill="none"
      stroke="#141414"
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path
      d="M10 46c3 8 12 12 22 12 8 0 15-3 19-8"
      fill="none"
      stroke="var(--rot-accent-2)"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path
      d="M44 46.5 51.5 50 48 57.5"
      fill="none"
      stroke="var(--rot-accent-2)"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M54 46c-3-8-12-12-22-12"
      fill="none"
      stroke="var(--rot-accent-2)"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </svg>
);
