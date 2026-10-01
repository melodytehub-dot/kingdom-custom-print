"use client";

import type { DesignLayer } from "@/lib/types";

interface Props {
  layers: DesignLayer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

function describe(layer: DesignLayer): string {
  if (layer.type === "text") {
    const first = layer.text.split("\n")[0] || "Empty text";
    return first.length > 28 ? `${first.slice(0, 28)}…` : first;
  }
  return layer.name;
}

export default function LayerList({ layers, selectedId, onSelect, onRemove }: Props) {
  if (!layers.length) return null;

  return (
    <ul className="layer-list">
      {layers.map((layer) => (
        <li key={layer.id}>
          <button
            type="button"
            className={`layer-row${layer.id === selectedId ? " is-active" : ""}`}
            onClick={() => onSelect(layer.id)}
            aria-pressed={layer.id === selectedId}
          >
            <span className="layer-type" aria-hidden="true">
              {layer.type === "text" ? (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 4V3h12v1M8 3v10M5.5 13h5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <rect
                    x="1.8"
                    y="3"
                    width="12.4"
                    height="10"
                    rx="1.4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <circle cx="5.6" cy="6.6" r="1.1" fill="currentColor" />
                  <path
                    d="M2.4 11.4 6 8.4l2.6 2.2 2.2-1.8 2.8 2.6"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
            <span className="layer-name wrap-anywhere">{describe(layer)}</span>
          </button>
          <button
            type="button"
            className="layer-remove"
            onClick={() => onRemove(layer.id)}
            aria-label={`Remove ${layer.type === "text" ? "text" : "image"} layer`}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M3 5h12M7.5 5V3.5h3V5M5 5l.8 10.2A1 1 0 0 0 6.8 16h4.4a1 1 0 0 0 1-.8L13 5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}