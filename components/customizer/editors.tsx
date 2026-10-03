"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ImageFx, ImageLayer, TextLayer } from "@/lib/types";
import { FONTS, fontsForScript, svgFontStack, type FontScript } from "@/lib/fonts";
import { DEFAULT_FX, dominantColours } from "@/lib/imageFx";
import {
  BackArrowIcon,
  CenterIcon,
  ChevronRightIcon,
  CloseIcon,
  DuplicateIcon,
  FlipHIcon,
  FlipVIcon,
  LayerBackIcon,
  LayerFrontIcon,
  LockIcon,
  SlashSwatch,
} from "./icons";

/* -------------------------------------------------------------------------
   Shared bits
   ------------------------------------------------------------------------- */

export interface InkColour {
  name: string;
  hex: string;
}

export const INKS: InkColour[] = [
  { name: "Black", hex: "#141414" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Charcoal", hex: "#4A4A4A" },
  { name: "Grey", hex: "#9A9A9A" },
  { name: "Silver", hex: "#C9CCD1" },
  { name: "Cream", hex: "#F3E9D0" },
  { name: "Red", hex: "#C8102E" },
  { name: "Maroon", hex: "#6B1022" },
  { name: "Orange", hex: "#F26B21" },
  { name: "Gold", hex: "#F2B705" },
  { name: "Yellow", hex: "#FFE135" },
  { name: "Kelly Green", hex: "#1C8C4E" },
  { name: "Forest", hex: "#1C4D32" },
  { name: "Teal", hex: "#0F7B8C" },
  { name: "Sky Blue", hex: "#63B3E8" },
  { name: "Royal", hex: "#1F4FB5" },
  { name: "Navy", hex: "#1B2A4A" },
  { name: "Purple", hex: "#5B2A8C" },
  { name: "Pink", hex: "#F06CA5" },
  { name: "Brown", hex: "#6B4423" },
];

export function inkName(hex: string): string {
  return INKS.find((i) => i.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex.toUpperCase();
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function PanelHeader({
  eyebrow,
  title,
  hint,
  onClose,
  onBack,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
  onClose?: () => void;
  onBack?: () => void;
}) {
  return (
    <header className="rot-phead">
      <div className="rot-phead-row">
        <div>
          <p className="rot-eyebrow">{eyebrow}</p>
          <h2 className="rot-ptitle">{title}</h2>
        </div>
        {onBack ? (
          <button type="button" className="rot-iconbtn" onClick={onBack} aria-label="Back">
            <BackArrowIcon size={26} />
          </button>
        ) : null}
        {onClose ? (
          <button type="button" className="rot-iconbtn" onClick={onClose} aria-label="Close">
            <CloseIcon size={30} />
          </button>
        ) : null}
      </div>
      {hint ? <p className="rot-phint">{hint}</p> : null}
    </header>
  );
}

export function Row({
  label,
  value,
  onClick,
  children,
}: {
  label: string;
  value?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const body = (
    <>
      <span className="rot-row-label">{label}</span>
      <span className="rot-row-value">
        {value}
        {onClick ? (
          <span className="rot-chev">
            <ChevronRightIcon size={16} />
          </span>
        ) : null}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" className="rot-row is-link" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="rot-row">
      {body}
      {children}
    </div>
  );
}

export function Swatch({ hex, none, size }: { hex?: string; none?: boolean; size?: number }) {
  return (
    <span
      className={`rot-swatch${none ? " is-none" : ""}`}
      style={{ background: none ? "#fff" : hex, width: size, height: size }}
    >
      {none ? <SlashSwatch /> : null}
    </span>
  );
}

export function Toggle({
  label,
  badge,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  badge?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rot-row" onClick={() => (disabled ? undefined : onChange(!checked))}>
      <span className="rot-row-label">
        {label}
        {badge ? <span className="rot-badge">{badge}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`rot-switch${checked ? " is-on" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
      >
        <span />
      </button>
    </div>
  );
}

export function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onChange,
  decimals = 0,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  decimals?: number;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value.toFixed(decimals);

  const commit = (raw: string) => {
    setDraft(null);
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) return;
    onChange(clamp(n, min, max));
  };

  return (
    <div className="rot-row rot-slider-row">
      <label className="rot-row-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="rot-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--fill" as string]: `${((clamp(value, min, max) - min) / (max - min)) * 100}%` }}
      />
      <input
        className="rot-num"
        inputMode="decimal"
        aria-label={`${label} value`}
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

export function ActionBar({
  locked,
  canBackward,
  canForward,
  onCenter,
  onBackward,
  onForward,
  onFlipH,
  onFlipV,
  flipH,
  flipV,
  onLock,
  onDuplicate,
}: {
  locked: boolean;
  canBackward: boolean;
  canForward: boolean;
  flipH: boolean;
  flipV: boolean;
  onCenter: () => void;
  onBackward: () => void;
  onForward: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onLock: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="rot-actionbar" role="toolbar" aria-label="Layer actions">
      <div className="rot-act">
        <button type="button" className="rot-actbtn" onClick={onCenter} aria-label="Center" disabled={locked}>
          <CenterIcon size={24} />
        </button>
        <span>Center</span>
      </div>
      <div className="rot-act">
        <div className="rot-actpair">
          <button
            type="button"
            className="rot-actbtn"
            onClick={onBackward}
            aria-label="Send backward"
            disabled={!canBackward}
          >
            <LayerBackIcon size={24} />
          </button>
          <button
            type="button"
            className="rot-actbtn"
            onClick={onForward}
            aria-label="Bring forward"
            disabled={!canForward}
          >
            <LayerFrontIcon size={24} />
          </button>
        </div>
        <span>Layering</span>
      </div>
      <div className="rot-act">
        <div className="rot-actpair">
          <button
            type="button"
            className={`rot-actbtn${flipH ? " is-on" : ""}`}
            onClick={onFlipH}
            aria-label="Flip horizontal"
            aria-pressed={flipH}
            disabled={locked}
          >
            <FlipHIcon size={24} />
          </button>
          <button
            type="button"
            className={`rot-actbtn${flipV ? " is-on" : ""}`}
            onClick={onFlipV}
            aria-label="Flip vertical"
            aria-pressed={flipV}
            disabled={locked}
          >
            <FlipVIcon size={24} />
          </button>
        </div>
        <span>Flip</span>
      </div>
      <div className="rot-act">
        <button
          type="button"
          className={`rot-actbtn is-solid${locked ? " is-on" : ""}`}
          onClick={onLock}
          aria-label={locked ? "Unlock" : "Lock"}
          aria-pressed={locked}
        >
          <LockIcon size={24} open={!locked} />
        </button>
        <span>{locked ? "Unlock" : "Lock"}</span>
      </div>
      <div className="rot-act">
        <button type="button" className="rot-actbtn" onClick={onDuplicate} aria-label="Duplicate">
          <DuplicateIcon size={24} />
        </button>
        <span>Duplicate</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Colour + font pickers (sub-views)
   ------------------------------------------------------------------------- */

export function ColorView({
  title,
  value,
  allowNone,
  onPick,
  onBack,
}: {
  title: string;
  value: string | null;
  allowNone?: boolean;
  onPick: (hex: string | null) => void;
  onBack: () => void;
}) {
  const custom = value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#141414";
  return (
    <>
      <PanelHeader eyebrow="Text Editor" title={title} onBack={onBack} />
      <div className="rot-colorgrid">
        {allowNone ? (
          <button
            type="button"
            className={`rot-colorcell${value === null ? " is-active" : ""}`}
            onClick={() => onPick(null)}
            aria-pressed={value === null}
          >
            <Swatch none size={44} />
            <span>None</span>
          </button>
        ) : null}
        {INKS.map((ink) => {
          const active = value?.toLowerCase() === ink.hex.toLowerCase();
          return (
            <button
              key={ink.hex}
              type="button"
              className={`rot-colorcell${active ? " is-active" : ""}`}
              onClick={() => onPick(ink.hex)}
              aria-pressed={active}
            >
              <Swatch hex={ink.hex} size={44} />
              <span>{ink.name}</span>
            </button>
          );
        })}
        <label className="rot-colorcell">
          <span className="rot-swatch rot-swatch-custom" style={{ width: 44, height: 44 }}>
            <input
              type="color"
              value={custom}
              onChange={(e) => onPick(e.target.value.toUpperCase())}
              aria-label="Custom colour"
            />
          </span>
          <span>Custom</span>
        </label>
      </div>
    </>
  );
}

export function FontView({
  value,
  script,
  onPick,
  onBack,
}: {
  value: string;
  script: FontScript;
  onPick: (font: string) => void;
  onBack: () => void;
}) {
  const list = fontsForScript(script);
  return (
    <>
      <PanelHeader eyebrow="Text Editor" title="Choose a Font" onBack={onBack} />
      <ul className="rot-fontlist">
        {list.map((f) => (
          <li key={f.value}>
            <button
              type="button"
              className={`rot-fontitem${f.value === value ? " is-active" : ""}`}
              style={{ fontFamily: svgFontStack(f.value) }}
              onClick={() => onPick(f.value)}
              aria-pressed={f.value === value}
            >
              {f.label}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* -------------------------------------------------------------------------
   Text editor
   ------------------------------------------------------------------------- */

const SCRIPTS: { id: FontScript; label: string }[] = [
  { id: "latin", label: "English" },
  { id: "greek", label: "Greek" },
  { id: "hebrew", label: "Hebrew" },
];

export interface LayerActionsProps {
  locked: boolean;
  canBackward: boolean;
  canForward: boolean;
  flipH: boolean;
  flipV: boolean;
  onCenter: () => void;
  onBackward: () => void;
  onForward: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onLock: () => void;
  onDuplicate: () => void;
}

/** Visual size of text = font size × average stretch, shown like the reference (1.0 ≈ default). */
const effectiveSize = (l: TextLayer) => (l.fontSize * ((l.scaleX + l.scaleY) / 2)) / 10;

export function TextEditor({
  layer,
  focusToken,
  actions,
  onChange,
  onClose,
}: {
  layer: TextLayer;
  focusToken: number;
  actions: LayerActionsProps;
  onChange: (patch: Partial<TextLayer>) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"main" | "font" | "color" | "outline">("main");
  const [script, setScript] = useState<FontScript>("latin");
  const area = useRef<HTMLTextAreaElement>(null);
  const locked = actions.locked;

  useEffect(() => {
    if (focusToken > 0) area.current?.focus();
  }, [focusToken]);

  // A layer switch always returns to the main view.
  useEffect(() => {
    // This local view intentionally resets when the selected layer changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView("main");
  }, [layer.id]);

  const fontLabel = FONTS.find((f) => f.value === layer.font)?.label ?? layer.font;

  if (view === "font") {
    return (
      <FontView
        value={layer.font}
        script={script}
        onPick={(font) => {
          onChange({ font });
          setView("main");
        }}
        onBack={() => setView("main")}
      />
    );
  }
  if (view === "color") {
    return (
      <ColorView
        title="Text Color"
        value={layer.color}
        onPick={(hex) => {
          if (hex) onChange({ color: hex });
          setView("main");
        }}
        onBack={() => setView("main")}
      />
    );
  }
  if (view === "outline") {
    return (
      <ColorView
        title="Outline Color"
        value={layer.strokeWidth > 0 ? layer.strokeColor : null}
        allowNone
        onPick={(hex) => {
          if (hex === null) onChange({ strokeWidth: 0 });
          else onChange({ strokeColor: hex, strokeWidth: layer.strokeWidth > 0 ? layer.strokeWidth : 6 });
          setView("main");
        }}
        onBack={() => setView("main")}
      />
    );
  }

  const scaleBy = (target: number) => {
    const cur = effectiveSize(layer) || 0.1;
    const k = clamp(target, 0.2, 6) / cur;
    onChange({
      scaleX: clamp(Math.round(layer.scaleX * k * 100) / 100, 0.05, 8),
      scaleY: clamp(Math.round(layer.scaleY * k * 100) / 100, 0.05, 8),
    });
  };

  return (
    <div className="rot-editor">
      <div className="rot-editor-scroll">
        <div className="rot-te-head">
          <h2 className="rot-ptitle">Text Editor</h2>
          <div className="rot-tabs" role="tablist" aria-label="Keyboard language">
            {SCRIPTS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={script === s.id}
                className={`rot-tab${script === s.id ? " is-active" : ""}`}
                onClick={() => {
                  setScript(s.id);
                  const ok = fontsForScript(s.id).some((f) => f.value === layer.font);
                  if (!ok) onChange({ font: fontsForScript(s.id)[0].value });
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          ref={area}
          className="rot-textarea"
          value={layer.text}
          rows={2}
          dir={script === "hebrew" ? "rtl" : "ltr"}
          aria-label="Your text"
          placeholder="Type your text"
          onChange={(e) => onChange({ text: e.target.value })}
        />

        <Row
          label="Font"
          onClick={() => setView("font")}
          value={
            <span className="rot-fontname" style={{ fontFamily: svgFontStack(layer.font) }}>
              {fontLabel}
            </span>
          }
        />
        <Row
          label="Color"
          onClick={() => setView("color")}
          value={
            <>
              <strong>{inkName(layer.color)}</strong>
              <Swatch hex={layer.color} />
            </>
          }
        />
        <Row
          label="Outline"
          onClick={() => setView("outline")}
          value={
            layer.strokeWidth > 0 ? (
              <>
                <strong>{inkName(layer.strokeColor)}</strong>
                <Swatch hex={layer.strokeColor} />
              </>
            ) : (
              <>
                <strong>None</strong>
                <Swatch none />
              </>
            )
          }
        />
        {layer.strokeWidth > 0 ? (
          <SliderRow
            label="Outline Size"
            min={1}
            max={25}
            step={1}
            value={layer.strokeWidth}
            onChange={(v) => onChange({ strokeWidth: v })}
          />
        ) : null}

        <SliderRow
          label="Size"
          min={0.2}
          max={6}
          step={0.1}
          decimals={1}
          value={effectiveSize(layer)}
          onChange={scaleBy}
        />
        <SliderRow
          label="Arc"
          min={-100}
          max={100}
          step={1}
          value={layer.arc ?? 0}
          onChange={(v) => onChange({ arc: v })}
        />
        <SliderRow
          label="Rotate"
          min={-180}
          max={180}
          step={1}
          value={layer.rotation}
          onChange={(v) => onChange({ rotation: Math.round(v) })}
        />
        <SliderRow
          label="Spacing"
          min={40}
          max={300}
          step={5}
          value={100 + layer.letterSpacing * 10}
          onChange={(v) => onChange({ letterSpacing: Math.round(((v - 100) / 10) * 10) / 10 })}
        />
        <SliderRow
          label="Opacity"
          min={10}
          max={100}
          step={5}
          value={Math.round(layer.opacity * 100)}
          onChange={(v) => onChange({ opacity: v / 100 })}
        />

        <div className="rot-row rot-style-row" role="group" aria-label="Text style">
          <span className="rot-row-label">Style</span>
          <div className="rot-chips">
            <button
              type="button"
              className={`rot-chip${layer.weight >= 700 ? " is-on" : ""}`}
              aria-pressed={layer.weight >= 700}
              onClick={() => onChange({ weight: layer.weight >= 700 ? 400 : 700 })}
              aria-label="Bold"
            >
              <b>B</b>
            </button>
            <button
              type="button"
              className={`rot-chip${layer.italic ? " is-on" : ""}`}
              aria-pressed={layer.italic}
              onClick={() => onChange({ italic: !layer.italic })}
              aria-label="Italic"
            >
              <i>I</i>
            </button>
            <button
              type="button"
              className={`rot-chip${layer.uppercase ? " is-on" : ""}`}
              aria-pressed={layer.uppercase}
              onClick={() => onChange({ uppercase: !layer.uppercase })}
              aria-label="All caps"
            >
              AA
            </button>
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={`rot-chip${layer.align === a ? " is-on" : ""}`}
                aria-pressed={layer.align === a}
                onClick={() => onChange({ align: a })}
                aria-label={`Align ${a}`}
              >
                <span className={`rot-align rot-align-${a}`} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </button>
            ))}
          </div>
        </div>
        {locked ? <p className="rot-phint rot-lockhint">This element is locked. Unlock it to move or resize.</p> : null}
        <button type="button" className="rot-textlink" onClick={onClose}>
          Done editing
        </button>
      </div>
      <ActionBar {...actions} />
    </div>
  );
}

/* -------------------------------------------------------------------------
   Image editor
   ------------------------------------------------------------------------- */

export function ImageEditor({
  layer,
  busy,
  eyebrow,
  actions,
  onFx,
  onChange,
  onReset,
  onClose,
}: {
  layer: ImageLayer;
  busy: boolean;
  eyebrow: string;
  actions: LayerActionsProps;
  onFx: (next: Partial<ImageFx>) => void;
  onChange: (patch: Partial<ImageLayer>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const fx = layer.fx ?? DEFAULT_FX;
  const original = layer.origSrc ?? layer.src;
  const [palette, setPalette] = useState<string[]>([]);
  const [view, setView] = useState<"main" | "colors" | "ink">("main");
  const colourFor = (hex: string) => fx.recolors.find((r) => r.from === hex)?.to ?? hex;

  useEffect(() => {
    let live = true;
    dominantColours(original, 3)
      .then((c) => live && setPalette(c))
      .catch(() => live && setPalette([]));
    return () => {
      live = false;
    };
  }, [original]);

  useEffect(() => {
    // This local view intentionally resets when the selected layer changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView("main");
  }, [layer.id]);

  const avg = (layer.scaleX + layer.scaleY) / 2;

  if (view === "ink") {
    return (
      <ColorView
        title="Ink Color"
        value={fx.inkColor}
        onPick={(hex) => {
          if (hex) onFx({ inkColor: hex, filter: "single" });
          setView("main");
        }}
        onBack={() => setView("main")}
      />
    );
  }

  if (view === "colors") {
    return (
      <div className="rot-editor">
        <div className="rot-editor-scroll">
        <PanelHeader
          eyebrow={eyebrow}
          title="Edit Colors"
          hint="Tap a colour to swap it for another ink. Close matches in your artwork change together."
          onBack={() => setView("main")}
        />
        {palette.length === 0 ? (
          <p className="rot-phint">No distinct colours were found in this artwork.</p>
        ) : (
          <ul className="rot-colorlist">
            {palette.map((hex) => (
              <li key={hex}>
                <label className="rot-colorline">
                  <Swatch hex={colourFor(hex)} size={44} />
                  <span>
                    {hex} <ChevronRightIcon size={14} />
                    <strong> {colourFor(hex) === hex ? "Original" : colourFor(hex)}</strong>
                  </span>
                  <input
                    type="color"
                    className="rot-hidden-color"
                    value={colourFor(hex).toLowerCase()}
                    onChange={(e) => {
                      const to = e.target.value.toUpperCase();
                      const rest = fx.recolors.filter((r) => r.from !== hex);
                      onFx({ recolors: to === hex ? rest : [...rest, { from: hex, to }] });
                    }}
                    aria-label={`Replace ${hex}`}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
        {fx.recolors.length ? (
          <button type="button" className="rot-textlink" onClick={() => onFx({ recolors: [] })}>
            Restore original colours
          </button>
        ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rot-editor">
      <div className="rot-editor-scroll">
        <PanelHeader
          eyebrow={eyebrow}
          title="Edit Your Artwork"
          hint="Our design professionals will select ink colors for you or tell us your preferred colors at checkout."
          onClose={onClose}
        />

        <h3 className="rot-sub">Filters</h3>
        <div className="rot-filters" role="radiogroup" aria-label="Filters">
          {(
            [
              ["normal", "Normal"],
              ["single", "Single Color"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={fx.filter === id}
              className={`rot-filter${fx.filter === id ? " is-active" : ""}`}
              disabled={busy}
              onClick={() => onFx({ filter: id })}
            >
              <span className="rot-filter-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={original}
                  alt=""
                  style={id === "single" ? { filter: "grayscale(1) contrast(1.15)" } : undefined}
                />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <Row
          label="Edit Colors"
          onClick={() => setView("colors")}
          value={
            <span className="rot-swatches">
              {(fx.filter === "single" ? [fx.inkColor] : palette).map((hex) => (
                <Swatch key={hex} hex={fx.filter === "single" ? hex : colourFor(hex)} />
              ))}
            </span>
          }
        />
        {fx.filter === "single" ? (
          <Row
            label="Ink Color"
            onClick={() => setView("ink")}
            value={
              <>
                <strong>{inkName(fx.inkColor)}</strong>
                <Swatch hex={fx.inkColor} />
              </>
            }
          />
        ) : null}
        <Toggle
          label="Remove Background"
          badge="AI"
          checked={fx.removeBg}
          disabled={busy}
          onChange={(v) => onFx({ removeBg: v })}
        />
        <Toggle
          label="Crop & Trim"
          checked={fx.crop}
          disabled={busy}
          onChange={(v) => onFx({ crop: v })}
        />
        <Toggle
          label="Super Resolution"
          badge="AI"
          checked={fx.superRes}
          disabled={busy}
          onChange={(v) => onFx({ superRes: v })}
        />

        <SliderRow
          label="Size"
          min={0.1}
          max={4}
          step={0.05}
          decimals={2}
          value={avg}
          onChange={(v) => {
            const k = v / (avg || 1);
            onChange({
              scaleX: clamp(Math.round(layer.scaleX * k * 100) / 100, 0.05, 8),
              scaleY: clamp(Math.round(layer.scaleY * k * 100) / 100, 0.05, 8),
            });
          }}
        />
        <SliderRow
          label="Rotate"
          min={-180}
          max={180}
          step={1}
          value={layer.rotation}
          onChange={(v) => onChange({ rotation: Math.round(v) })}
        />
        <SliderRow
          label="Opacity"
          min={10}
          max={100}
          step={5}
          value={Math.round(layer.opacity * 100)}
          onChange={(v) => onChange({ opacity: v / 100 })}
        />
        {busy ? <p className="rot-phint">Working on your artwork…</p> : null}
        <button type="button" className="rot-textlink" onClick={onReset} disabled={busy}>
          Reset to Defaults
        </button>
      </div>
      <ActionBar {...actions} />
    </div>
  );
}
