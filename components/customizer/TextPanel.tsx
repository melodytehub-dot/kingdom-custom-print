"use client";

import type { TextLayer } from "@/lib/types";

interface Props {
  layer: TextLayer;
  fonts: { value: string; label: string }[];
  inks: string[];
  onChange: (patch: Partial<TextLayer>) => void;
}

export default function TextPanel({ layer, fonts, inks, onChange }: Props) {
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="text-panel">
      <div className="field">
        <label className="label" htmlFor={`txt-${layer.id}`}>
          Text
        </label>
        <textarea
          id={`txt-${layer.id}`}
          className="textarea"
          value={layer.text}
          rows={2}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Type your text"
        />
      </div>

      <div className="field-grid">
        <div className="field">
          <label className="label" htmlFor={`font-${layer.id}`}>
            Typeface
          </label>
          <select
            id={`font-${layer.id}`}
            className="select"
            value={layer.font}
            onChange={(e) => onChange({ font: e.target.value })}
          >
            {fonts.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor={`size-${layer.id}`}>
            Size
          </label>
          <input
            id={`size-${layer.id}`}
            className="input"
            type="number"
            min={2}
            max={40}
            step={0.5}
            value={layer.fontSize}
            onChange={(e) =>
              onChange({ fontSize: Math.min(40, Math.max(2, num(e.target.value))) })
            }
          />
        </div>
      </div>

      <div className="field">
        <span className="label">Ink color</span>
        <div className="swatches">
          {inks.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${c === layer.color ? " is-active" : ""}`}
              style={{ background: c }}
              onClick={() => onChange({ color: c })}
              aria-pressed={c === layer.color}
              title={c}
            >
              <span className="sr-only">{c}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor={`custom-${layer.id}`}>
          Custom color
        </label>
        <input
          id={`custom-${layer.id}`}
          className="input input-color"
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(layer.color) ? layer.color : "#141414"}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </div>

      <div className="field-grid">
        <div className="field">
          <label className="label" htmlFor={`weight-${layer.id}`}>
            Weight
          </label>
          <select
            id={`weight-${layer.id}`}
            className="select"
            value={layer.weight}
            onChange={(e) =>
              onChange({ weight: Number(e.target.value) as TextLayer["weight"] })
            }
          >
            <option value={400}>Regular</option>
            <option value={700}>Bold</option>
            <option value={900}>Black</option>
          </select>
        </div>

        <div className="field">
          <label className="label" htmlFor={`align-${layer.id}`}>
            Alignment
          </label>
          <select
            id={`align-${layer.id}`}
            className="select"
            value={layer.align}
            onChange={(e) => onChange({ align: e.target.value as TextLayer["align"] })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>

      <div className="toggle-row" role="group" aria-label="Text style">
        <button
          type="button"
          className={`toggle${layer.uppercase ? " is-on" : ""}`}
          aria-pressed={layer.uppercase}
          onClick={() => onChange({ uppercase: !layer.uppercase })}
        >
          Uppercase
        </button>
        <button
          type="button"
          className={`toggle${layer.italic ? " is-on" : ""}`}
          aria-pressed={layer.italic}
          onClick={() => onChange({ italic: !layer.italic })}
        >
          Italic
        </button>
      </div>

      <label className="range-row" htmlFor={`rot-${layer.id}`}>
        <span>Rotation</span>
        <input
          id={`rot-${layer.id}`}
          type="range"
          min={-45}
          max={45}
          step={1}
          value={layer.rotation}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
        />
        <span className="tnum small">{layer.rotation}°</span>
      </label>

      <label className="range-row" htmlFor={`trk-${layer.id}`}>
        <span>Letter spacing</span>
        <input
          id={`trk-${layer.id}`}
          type="range"
          min={-4}
          max={30}
          step={1}
          value={layer.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
        />
        <span className="tnum small">{layer.letterSpacing}</span>
      </label>
    </div>
  );
}