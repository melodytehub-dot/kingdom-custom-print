"use client";

import { useId } from "react";

function colorMatrix(color: string): string | null {
  const channels = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!channels) return null;
  const [red, green, blue] = channels.slice(1).map((value) => Number.parseInt(value, 16) / 255);
  return `${red} 0 0 0 0  0 ${green} 0 0 0  0 0 ${blue} 0 0  0 0 0 1 0`;
}

/** Self-contained garment preview that avoids the nested-image SVG endpoint. */
export function GarmentPreview({
  src,
  color,
  className,
  label = "",
}: {
  src: string;
  color?: string;
  className: string;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const matrix = color ? colorMatrix(color) : null;
  const filterId = `${id}-fabric`;

  return (
    <svg
      className={className}
      viewBox="0 0 900 900"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {matrix ? (
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={matrix} />
          </filter>
        </defs>
      ) : null}
      <image
        href={src}
        x="0"
        y="0"
        width="900"
        height="900"
        preserveAspectRatio="xMidYMid meet"
        filter={matrix ? `url(#${filterId})` : undefined}
      />
    </svg>
  );
}
