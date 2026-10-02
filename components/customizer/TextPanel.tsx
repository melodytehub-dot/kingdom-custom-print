"use client";

import type { TextLayer } from "@/lib/types";
import { FONTS } from "@/lib/fonts";

interface Props {
  layer: TextLayer;
  inks: string[];
  onChange: (patch: Partial<TextLayer>) => void;
}

const num = (v: string) => (v === "" ? 0 : Number(v));

export default function TextPanel({ layer, inks, onChange }: Props) {
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

      <div className="field">
        <label className="label" htmlFor={`font-${layer.id}`}>
          Font
        </label>
        <select
          id={`font-${layer.id}`}
          className="select"
          value={layer.font}
          onChange={(e) => onChange({ font: e.target.value })}
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field-grid">
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
            onChange={(e) => onChange({ fontSize: Math.min(40, Math.max(2, num(e.target.value))) })}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor={`weight-${layer.id}`}>
            Weight
          </label>
          <select
            id={`weight-${layer.id}`}
            className="select"
            value={layer.weight}
            onChange={(e) => onChange({ weight: Number(e.target.value) as TextLayer["weight"] })}
          >
            <option value={400}>Regular</option>
            <option value={700}>Bold</option>
            <option value={900}>Black</option>
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
          AA
        </button>
        <button
          type="button"
          className={`toggle${layer.italic ? " is-on" : ""}`}
          aria-pressed={layer.italic}
          onClick={() => onChange({ italic: !layer.italic })}
        >
          <em>Italic</em>
        </button>
        {(["left", "center", "right"] as const).map((a) => (
          <button
            key={a}
            type="button"
            className={`toggle${layer.align === a ? " is-on" : ""}`}
            aria-pressed={layer.align === a}
            onClick={() => onChange({ align: a })}
            title={`Align ${a}`}
          >
            {a === "left" ? "L" : a === "center" ? "C" : "R"}
          </button>
        ))}
      </div>

      <div className="field">
        <span className="label">Text color</span>
        <div className="swatches">
          {inks.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${c.toLowerCase() === layer.color.toLowerCase() ? " is-active" : ""}`}
              style={{ background: c }}
              onClick={() => onChange({ color: c })}
              aria-pressed={c.toLowerCase() === layer.color.toLowerCase()}
              title={c}
            >
              <span className="sr-only">{c}</span>
            </button>
          ))}
          <label className="swatch swatch-custom" title="Custom color">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(layer.color) ? layer.color : "#141414"}
              onChange={(e) => onChange({ color: e.target.value })}
              aria-label="Custom text color"
            />
          </label>
        </div>
      </div>

      <div className="field">
        <span className="label">
          Outline <span className="opt-value">{layer.strokeWidth > 0 ? `${layer.strokeWidth}%` : "Off"}</span>
        </span>
        <div className="swatches">
          {["#FFFFFF", "#141414", "#C8102E", "#E8A317", "#1C6B45", "#26314C"].map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${c.toLowerCase() === layer.strokeColor.toLowerCase() ? " is-active" : ""}`}
              style={{ background: c }}
              onClick={() => onChange({ strokeColor: c })}
              aria-pressed={c.toLowerCase() === layer.strokeColor.toLowerCase()}
              title={c}
            >
              <span className="sr-only">{c}</span>
            </button>
          ))}
          <label className="swatch swatch-custom" title="Custom outline color">
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(layer.strokeColor) ? layer.strokeColor : "#ffffff"}
              onChange={(e) => onChange({ strokeColor: e.target.value })}
              aria-label="Custom outline color"
            />
          </label>
        </div>
        <label className="range-row" htmlFor={`stroke-${layer.id}`}>
          <span>Width</span>
          <input
            id={`stroke-${layer.id}`}
            type="range"
            min={0}
            max={25}
            step={1}
            value={layer.strokeWidth}
            onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
          />
          <span className="tnum small">{layer.strokeWidth}</span>
        </label>
      </div>

      <label className="range-row" htmlFor={`trk-${layer.id}`}>
        <span>Letter spacing</span>
        <input
          id={`trk-${layer.id}`}
          type="range"
          min={-6}
          max={40}
          step={1}
          value={layer.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
        />
        <span className="tnum small">{layer.letterSpacing}</span>
      </label>

      <label className="range-row" htmlFor={`lh-${layer.id}`}>
        <span>Line height</span>
        <input
          id={`lh-${layer.id}`}
          type="range"
          min={0.8}
          max={2}
          step={0.05}
          value={layer.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
        />
        <span className="tnum small">{layer.lineHeight.toFixed(2)}</span>
      </label>

      <label className="range-row" htmlFor={`rot-${layer.id}`}>
        <span>Rotation</span>
        <input
          id={`rot-${layer.id}`}
          type="range"
          min={-180}
          max={180}
          step={1}
          value={layer.rotation}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
        />
        <span className="tnum small">{layer.rotation}°</span>
      </label>

      <label className="range-row" htmlFor={`op-${layer.id}`}>
        <span>Opacity</span>
        <input
          id={`op-${layer.id}`}
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={layer.opacity}
          onChange={(e) => onChange({ opacity: Number(e.target.value) })}
        />
        <span className="tnum small">{Math.round(layer.opacity * 100)}%</span>
      </label>
    </div>
  );
}
