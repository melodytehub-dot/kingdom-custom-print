"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Garment from "@/components/Garment";
import DesignCanvas from "./DesignCanvas";
import TextPanel from "./TextPanel";
import LayerList from "./LayerList";
import {
  emptyDesign,
  loadDrafts,
  newImageLayer,
  newTextLayer,
  persistDrafts,
  readImageFile,
  removeLayer,
  updateLayer,
  usedSides,
  validateUpload,
  type SavedDraft,
} from "@/lib/design";
import { drawPreview } from "./preview";
import { useCart } from "@/lib/cart-context";
import { formatUSD, quoteProduct } from "@/lib/pricing";
import type {
  Design,
  DesignLayer,
  GarmentSide,
  Product,
  SizeLine,
} from "@/lib/types";

const FONT_OPTIONS = [
  { value: "anton", label: "Impact" },
  { value: "inter", label: "Grotesk" },
  { value: "serif", label: "Serif" },
];

const INK_COLORS = ["#141414", "#FFFFFF", "#C8102E", "#1C6B45", "#E8A317", "#26314C", "#6B6862"];

type Step = "design" | "quantity" | "review";

const STEP_ORDER: Step[] = ["design", "quantity", "review"];

interface DraftState {
  colorSlug: string;
  design: Design;
  lines: Record<string, number>;
}

export default function Customizer({
  product,
  products,
  initialColor,
  initialLines,
}: {
  product: Product;
  products: Product[];
  initialColor: string;
  initialLines: Record<string, number>;
}) {
  const { addItem } = useCart();

  const [step, setStep] = useState<Step>("design");
  const [side, setSide] = useState<GarmentSide>("front");
  const [colorSlug, setColorSlug] = useState(initialColor || product.colors[0]?.slug || "");
  const [design, setDesign] = useState<Design>(emptyDesign);
  const [lines, setLines] = useState<Record<string, number>>(initialLines);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const fileInput = useRef<HTMLInputElement>(null);
  const draftKey = `kcp.draft.${product.slug}`;

  const color = useMemo(
    () => product.colors.find((c) => c.slug === colorSlug) ?? product.colors[0],
    [colorSlug, product.colors]
  );

  const sizeLines = useMemo<SizeLine[]>(
    () => product.sizes.map((s) => ({ label: s.label, qty: lines[s.label] ?? 0 })),
    [product.sizes, lines]
  );

  const quantity = sizeLines.reduce((n, l) => n + l.qty, 0);
  const sides = usedSides(design);
  const quote = quoteProduct(product, { sides, lines: sizeLines });
  const layers = design[side];
  const selected = selectedId ? layers.find((l) => l.id === selectedId) : undefined;

  /* ---- restore draft on mount ----
   * localStorage is an external system that is unreadable during SSR, so the
   * draft can only be adopted on the client after the first paint. This is the
   * documented exception to the set-state-in-effect rule.
   */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDrafts(loadDrafts());
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftState;
      if (parsed?.design?.front && parsed?.design?.back) setDesign(parsed.design);
      if (parsed?.colorSlug) setColorSlug(parsed.colorSlug);
    } catch {
      // A corrupt draft should not block the editor; start clean.
    }
  }, [draftKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* ---- autosave draft ---- */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ colorSlug, design, lines } satisfies DraftState)
      );
    } catch {
      // Storage unavailable or full; the in-progress design still works.
    }
  }, [draftKey, colorSlug, design, lines]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5200);
    return () => clearTimeout(t);
  }, [notice]);

  const patch = useCallback(
    (targetSide: GarmentSide, id: string, changes: Partial<DesignLayer>) => {
      setDesign((prev) => updateLayer(prev, targetSide, id, changes));
    },
    []
  );

  /** Convenience wrapper that patches the side currently being edited. */
  const patchActive = useCallback(
    (id: string, changes: Partial<DesignLayer>) => {
      setDesign((prev) => updateLayer(prev, side, id, changes));
    },
    [side]
  );

  const addText = () => {
    const layer = newTextLayer();
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], layer] }));
    setSelectedId(layer.id);
    setNotice({ tone: "ok", text: "Text added. Edit it in the panel below the canvas." });
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    const check = validateUpload(file);
    if (!check.ok) {
      setNotice({ tone: "error", text: check.error ?? "That file cannot be used." });
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const decoded = await readImageFile(file);
      const layer = newImageLayer(decoded.dataUrl, file.name);
      setDesign((prev) => ({ ...prev, [side]: [...prev[side], layer] }));
      setSelectedId(layer.id);
      setNotice({
        tone: check.warning ? "warn" : "ok",
        text:
          check.warning ??
          `Added at ${decoded.width} × ${decoded.height}px. Drag the handles to fit.`,
      });
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof Error ? err.message : "We could not read that file.",
      });
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const saveDraft = () => {
    const entry: SavedDraft = {
      id: `d-${Date.now().toString(36)}`,
      productSlug: product.slug,
      productName: product.name,
      colorSlug,
      colorName: color?.name ?? "",
      colorHex: color?.hex ?? "#141414",
      design,
      savedAt: Date.now(),
    };
    const next = [entry, ...drafts.filter((d) => d.id !== entry.id)].slice(0, 12);
    setDrafts(next);
    persistDrafts(next);
    setNotice({ tone: "ok", text: "Design saved to this device." });
  };

  const loadDraft = (id: string) => {
    const found = drafts.find((d) => d.id === id);
    if (!found) return;
    setDesign(found.design);
    setSelectedId(null);
    setNotice({ tone: "ok", text: `Loaded your saved ${found.productName} design.` });
  };

  const deleteDraft = (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    persistDrafts(next);
  };

  const clearSide = () => {
    setDesign((prev) => ({ ...prev, [side]: [] }));
    setSelectedId(null);
  };

  const setQty = (label: string, value: number) => {
    setLines((prev) => ({
      ...prev,
      [label]: Math.max(0, Math.min(999, Math.floor(Number(value) || 0))),
    }));
  };

  const fillAllInSize = (label: string) => {
    const total = quantity || 1;
    setLines(
      Object.fromEntries(product.sizes.map((s) => [s.label, s.label === label ? total : 0]))
    );
  };

  const handleAddToCart = async () => {
    if (quantity <= 0) {
      setNotice({ tone: "error", text: "Set a quantity for at least one size first." });
      setStep("quantity");
      return;
    }
    if (sides.length === 0) {
      setNotice({
        tone: "warn",
        text: "No artwork added — this garment will be added blank.",
      });
    }

    setBusy(true);
    try {
      const previews = await drawPreview(product, color?.hex ?? "#141414", design);
      addItem({
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        productKind: product.kind,
        colorSlug: color?.slug ?? "",
        colorName: color?.name ?? "",
        colorHex: color?.hex ?? "#141414",
        sidesUsed: sides,
        design,
        previewFront: previews.front,
        previewBack: previews.back,
        lines: sizeLines.filter((l) => l.qty > 0),
        surcharges: Object.fromEntries(
          product.sizes.map((sz) => [sz.label, sz.surcharge])
        ),
        unitPrice: quote.unitBase,
        total: quote.total,
        quantity,
      });
      setAddedCount((n) => n + 1);
      setNotice({ tone: "ok", text: "Added to cart." });
      setDesign(emptyDesign());
      setLines(Object.fromEntries(product.sizes.map((s) => [s.label, 0])));
      setSelectedId(null);
    } catch {
      setNotice({
        tone: "error",
        text: "We could not render a preview of that design. Try a smaller image.",
      });
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="customizer">
      {/* Step rail */}
      <nav aria-label="Order steps">
        <ol className="steps-rail">
          {(["design", "quantity", "review"] as const).map((key, i) => {
            const active = step === key;
            const label = key === "quantity" ? "Quantity" : key[0].toUpperCase() + key.slice(1);
            return (
              <li key={key} className="rail-step">
                <button
                  type="button"
                  className={`rail-btn${active ? " is-active" : ""}${stepIndex > i ? " is-done" : ""}`}
                  aria-current={active ? "step" : undefined}
                  onClick={() => setStep(key)}
                >
                  <span className="rail-n tnum">{i + 1}</span>
                  <span className="rail-label">{label}</span>
                </button>
                {i < 2 ? (
                  <span
                    className={`rail-line${stepIndex > i ? " is-done" : ""}`}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="cust-layout">
        {/* ---------------- Preview stage ---------------- */}
        <section className="cust-stage" aria-label="Design preview">
          <div className="stage-head">
            <div className="side-switch" role="group" aria-label="Garment side">
              {(["front", "back"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`side-btn${side === s ? " is-active" : ""}`}
                  aria-pressed={side === s}
                  onClick={() => {
                    setSide(s);
                    setSelectedId(null);
                  }}
                >
                  {s === "front" ? "Front" : "Back"}
                  <span className="side-count tnum">{design[s].length || ""}</span>
                </button>
              ))}
            </div>
            {layers.length ? (
              <button type="button" className="link clear-side" onClick={clearSide}>
                Clear {side}
              </button>
            ) : null}
          </div>

          <DesignCanvas
            product={product}
            color={color?.hex ?? "#141414"}
            design={design}
            side={side}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={patch}
            onCommit={() => undefined}
          />

          {step === "design" ? (
            <>
              <div className="add-bar">
                <button type="button" className="btn" onClick={addText} disabled={busy}>
                  Add text
                </button>
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                >
                  {busy ? "Reading…" : "Upload artwork"}
                </button>
                <button type="button" className="btn btn-light" onClick={saveDraft}>
                  Save
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => onUpload(e.target.files?.[0])}
                  className="sr-only"
                  aria-label="Upload artwork file"
                />
              </div>

              {notice ? (
                <p
                  className={`cust-notice is-${notice.tone}`}
                  role={notice.tone === "error" ? "alert" : "status"}
                >
                  {notice.text}
                </p>
              ) : null}

              {drafts.length ? (
                <div className="drafts">
                  <p className="eyebrow">Saved designs</p>
                  <ul>
                    {drafts.map((d) => (
                      <li key={d.id}>
                        <button type="button" className="draft-load" onClick={() => loadDraft(d.id)}>
                          <Garment kind={product.kind} color={d.colorHex} />
                          <span className="draft-meta">
                            <span className="wrap-anywhere">{d.productName}</span>
                            <span className="small muted">
                              {new Date(d.savedAt).toLocaleDateString()}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => deleteDraft(d.id)}
                          aria-label={`Delete saved ${d.productName} design`}
                        >
                          <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
                            <path
                              d="M3 5h12M7.5 5V3.5h3V5M5 5l.8 10.2A1 1 0 0 0 6.8 16h4.4a1 1 0 0 0 1-.8L13 5"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {step === "review" ? (
            <div className="review-block">
              <p className="eyebrow">Design summary</p>
              <ul className="review-list">
                <li>
                  <span>Blank</span>
                  <strong>{product.name}</strong>
                </li>
                <li>
                  <span>Colour</span>
                  <strong>{color?.name}</strong>
                </li>
                <li>
                  <span>Printed sides</span>
                  <strong>
                    {sides.length ? sides.map((s) => (s === "front" ? "Front" : "Back")).join(" + ") : "Blank garment"}
                  </strong>
                </li>
                <li>
                  <span>Elements</span>
                  <strong>
                    {design.front.length + design.back.length || "None"}
                  </strong>
                </li>
                <li>
                  <span>Garments</span>
                  <strong className="tnum">{quantity}</strong>
                </li>
              </ul>
            </div>
          ) : null}
        </section>

        {/* ---------------- Control panel ---------------- */}
        <section className="cust-panel" aria-label="Design controls">
          {products.length > 1 ? (
            <div className="pane">
              <p className="label">Blank</p>
              <div className="blank-row">
                {products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/customize/${p.slug}`}
                    className={`blank-chip${p.id === product.id ? " is-active" : ""}`}
                    aria-current={p.id === product.id ? "true" : undefined}
                  >
                    <Garment kind={p.kind} color={p.colors[0]?.hex ?? "#141414"} />
                    <span className="wrap-anywhere">{p.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="pane">
            <p className="label">
              Colour <span className="opt-value">{color?.name}</span>
            </p>
            <div className="swatches">
              {product.colors.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className={`swatch${c.slug === color?.slug ? " is-active" : ""}`}
                  style={{ background: c.hex }}
                  onClick={() => setColorSlug(c.slug)}
                  aria-pressed={c.slug === color?.slug}
                  title={c.name}
                >
                  <span className="sr-only">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          {step === "design" ? (
            <div className="pane">
              <p className="label">
                {side === "front" ? "Front" : "Back"} layers
                <span className="opt-hint">{layers.length}</span>
              </p>

              <LayerList
                layers={layers}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onRemove={(id) => {
                  setDesign((prev) => removeLayer(prev, side, id));
                  if (selectedId === id) setSelectedId(null);
                }}
              />

              {layers.length === 0 ? (
                <p className="empty-note small muted">
                  Nothing on this side yet. Add text or upload artwork to begin.
                </p>
              ) : null}

              {selected?.type === "text" ? (
                <TextPanel
                  layer={selected}
                  fonts={FONT_OPTIONS}
                  inks={INK_COLORS}
                  onChange={(changes) => patchActive(selected.id, changes)}
                />
              ) : null}

              {selected?.type === "image" ? (
                <div className="image-inspector">
                  <p className="small wrap-anywhere">
                    <strong>{selected.name}</strong>
                  </p>
                  <label className="range-row" htmlFor={`op-${selected.id}`}>
                    <span>Opacity</span>
                    <input
                      id={`op-${selected.id}`}
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={selected.opacity}
                      onChange={(e) => patchActive(selected.id, { opacity: Number(e.target.value) })}
                    />
                    <span className="tnum small">{Math.round(selected.opacity * 100)}%</span>
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "quantity" ? (
            <div className="pane">
              <p className="label">
                Size run{" "}
                <span className="opt-hint">
                  {quantity} garment{quantity === 1 ? "" : "s"}
                </span>
              </p>
              <div className="size-run">
                {product.sizes.map((s) => (
                  <div
                    key={s.label}
                    className={`size-cell${(lines[s.label] ?? 0) > 0 ? " has-qty" : ""}`}
                  >
                    <label htmlFor={`c-qty-${s.label}`} className="size-label">
                      {s.label}
                      {s.surcharge > 0 ? (
                        <span className="size-add">+{formatUSD(s.surcharge)}</span>
                      ) : null}
                    </label>
                    <div className="size-stepper">
                      <button
                        type="button"
                        onClick={() => setQty(s.label, (lines[s.label] ?? 0) - 1)}
                        disabled={(lines[s.label] ?? 0) <= 0}
                        aria-label={`Decrease ${s.label}`}
                      >
                        &minus;
                      </button>
                      <input
                        id={`c-qty-${s.label}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={999}
                        value={lines[s.label] ?? 0}
                        onChange={(e) => setQty(s.label, Number(e.target.value))}
                        aria-label={`${s.label} quantity`}
                      />
                      <button
                        type="button"
                        onClick={() => setQty(s.label, (lines[s.label] ?? 0) + 1)}
                        aria-label={`Increase ${s.label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="quick-sizes">
                <span className="small muted">Put all {quantity || 1} in one size:</span>
                {["XS", "S", "M", "L", "XL", "2XL", "3XL"].map((label) => {
                  if (!product.sizes.some((s) => s.label === label)) return null;
                  return (
                    <button
                      key={label}
                      type="button"
                      className="quick-btn"
                      onClick={() => fillAllInSize(label)}
                    >
                      All {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="pane pane-summary">
            <div className="quote-row">
              <span>
                {product.name} · {color?.name}
              </span>
              <span className="tnum">
                {quantity > 0 ? `${quantity} × ${formatUSD(quote.unitBase)}` : "Set quantities"}
              </span>
            </div>

            <div className="quote-row">
              <span>
                {sides.length
                  ? `Decoration on ${sides.join(" + ")}`
                  : "No artwork yet"}
              </span>
              <span className="tnum">
                {formatUSD(sides.length * product.printFeePerSide)}
              </span>
            </div>

            {quote.appliedBreak ? (
              <div className="quote-row quote-tier">
                <span>Quantity break at {quote.appliedBreak}+ applied</span>
                <span className="tnum">per garment</span>
              </div>
            ) : null}

            <div className="quote-row quote-total">
              <span>Subtotal</span>
              <strong className="tnum">{quantity > 0 ? formatUSD(quote.total) : "—"}</strong>
            </div>

            <button
              type="button"
              className="btn btn-lg btn-block"
              onClick={handleAddToCart}
              disabled={busy}
            >
              {busy ? "Adding…" : addedCount > 0 ? "Add another" : "Add to cart"}
            </button>

            {addedCount > 0 ? (
              <Link href="/cart" className="btn btn-light btn-block">
                Go to cart ({addedCount})
              </Link>
            ) : null}

            <p className="hint">
              Shipping is calculated at checkout. Artwork is proofed before printing.
            </p>
          </div>

          {/* Step navigation */}
          <div className="pane-nav">
            {stepIndex > 0 ? (
              <button
                type="button"
                className="btn btn-light btn-block"
                onClick={() => setStep(STEP_ORDER[stepIndex - 1])}
              >
                Back
              </button>
            ) : null}
            {stepIndex < STEP_ORDER.length - 1 ? (
              <button
                type="button"
                className="btn btn-block"
                onClick={() => {
                  if (step === "design" && quantity <= 0) {
                    setNotice({
                      tone: "error",
                      text: "Set a quantity before reviewing.",
                    });
                  }
                  setStep(STEP_ORDER[stepIndex + 1]);
                }}
              >
                Continue to {STEP_ORDER[stepIndex + 1] === "quantity" ? "quantity" : "review"}
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}