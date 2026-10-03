"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import CartIcon from "@/components/icons/CartIcon";
import DesignCanvas from "./DesignCanvas";
import TextPanel from "./TextPanel";
import LayerList from "./LayerList";
import { ART_LIBRARY, type ArtItem } from "./art";
import {
  duplicateLayer,
  emptyDesign,
  loadDrafts,
  newImageLayer,
  newTextLayer,
  normalizeDesign,
  persistDrafts,
  readImageFile,
  removeLayer,
  reorderLayer,
  updateLayer,
  usedSides,
  validateUpload,
  type SavedDraft,
} from "@/lib/design";
import { drawPreview } from "./preview";
import { TEE_MOCKUPS, mockupForColor, type TeeMockup } from "@/lib/mockups";
import { FONTS } from "@/lib/fonts";
import { useCart } from "@/lib/cart-context";
import { formatUSD, quoteProduct } from "@/lib/pricing";
import type {
  Design,
  DesignLayer,
  GarmentSide,
  NameNumberStyle,
  Product,
  RosterEntry,
  SizeLine,
} from "@/lib/types";

const INK_COLORS = [
  "#141414",
  "#FFFFFF",
  "#C8102E",
  "#1C6B45",
  "#E8A317",
  "#26314C",
  "#6B6862",
  "#7A2E8E",
  "#0F7B8C",
];

type Step = "design" | "quantity" | "review";
type Tool = "products" | "text" | "art" | "upload" | "names" | "layers";

const STEP_ORDER: Step[] = ["design", "quantity", "review"];

const STEP_LABEL: Record<Step, string> = {
  design: "Design",
  quantity: "Quantity",
  review: "Review",
};

const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "products", label: "Products", icon: <ProductsGlyph /> },
  { id: "text", label: "Text", icon: <TextGlyph /> },
  { id: "upload", label: "Upload", icon: <UploadGlyph /> },
  { id: "art", label: "Clipart", icon: <ArtGlyph /> },
  { id: "names", label: "Names", icon: <NamesGlyph /> },
  { id: "layers", label: "Layers", icon: <LayersGlyph /> },
];

interface DraftState {
  colorCode: string;
  design: Design;
  lines: Record<string, number>;
}

const uid = () => `r-${Math.random().toString(36).slice(2, 9)}`;

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
  const { addItem, items } = useCart();

  const [step, setStep] = useState<Step>("design");
  const [tool, setTool] = useState<Tool>("products");
  const [side, setSide] = useState<GarmentSide>("front");
  const [zoom, setZoom] = useState(1);
  const [colorCode, setColorCode] = useState(() => {
    const match =
      TEE_MOCKUPS.find((m) => m.slug === initialColor || m.code === initialColor) ??
      mockupForColor(product.colors[0]?.name ?? "White", product.colors[0]?.hex ?? "#FFFFFF");
    return match?.code ?? "WHT";
  });
  const [design, setDesign] = useState<Design>(emptyDesign);
  const [lines, setLines] = useState<Record<string, number>>(initialLines);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [nnStyle, setNnStyle] = useState<NameNumberStyle>({
    font: "bebas",
    color: "#141414",
    strokeColor: "#FFFFFF",
    strokeWidth: 0,
  });

  const fileInput = useRef<HTMLInputElement>(null);
  const draftKey = `kcp.draft.v2.${product.slug}`;

  const historyRef = useRef<Design[]>([]);
  const futureRef = useRef<Design[]>([]);
  const applyingHistory = useRef(false);

  const syncHist = useCallback(() => {
    setHist({
      canUndo: historyRef.current.length > 1,
      canRedo: futureRef.current.length > 0,
    });
  }, []);

  const mockup: TeeMockup = useMemo(
    () => TEE_MOCKUPS.find((m) => m.code === colorCode) ?? TEE_MOCKUPS[0],
    [colorCode]
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
  const cartCount = items.reduce((n, i) => n + i.quantity, 0);

  /* ---- restore draft on mount ---- */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDrafts(loadDrafts());
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DraftState;
      if (parsed?.design?.front && parsed?.design?.back) {
        setDesign(normalizeDesign(parsed.design));
      }
      if (parsed?.colorCode && TEE_MOCKUPS.some((m) => m.code === parsed.colorCode)) {
        setColorCode(parsed.colorCode);
      }
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
        JSON.stringify({ colorCode, design, lines } satisfies DraftState)
      );
    } catch {
      // Storage unavailable or full; the in-progress design still works.
    }
  }, [draftKey, colorCode, design, lines]);

  /* ---- undo history (debounced so a drag is one step) ---- */
  useEffect(() => {
    if (applyingHistory.current) {
      applyingHistory.current = false;
      return;
    }
    const t = setTimeout(() => {
      historyRef.current = [...historyRef.current.slice(-29), design];
      futureRef.current = [];
      syncHist();
    }, 450);
    return () => clearTimeout(t);
  }, [design, syncHist]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5200);
    return () => clearTimeout(t);
  }, [notice]);

  /* ---- lock the page behind the full-screen studio on mobile ---- */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => {
      if (mq.matches) document.body.dataset.lock = "true";
      else delete document.body.dataset.lock;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      delete document.body.dataset.lock;
    };
  }, []);

  const patch = useCallback(
    (targetSide: GarmentSide, id: string, changes: Partial<DesignLayer>) => {
      setDesign((prev) => updateLayer(prev, targetSide, id, changes));
    },
    []
  );

  const patchActive = useCallback(
    (id: string, changes: Partial<DesignLayer>) => {
      setDesign((prev) => updateLayer(prev, side, id, changes));
    },
    [side]
  );

  const openTool = (next: Tool) => {
    setPanelOpen((open) => !(tool === next && open));
    setTool(next);
  };

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
  };

  /** Opens the editor for a layer — only fired by the canvas "edit" control. */
  const editLayer = (id: string) => {
    const layer = design[side].find((l) => l.id === id);
    if (!layer) return;
    setSelectedId(id);
    setTool(layer.type === "text" ? "text" : "layers");
    setPanelOpen(true);
  };

  const rotateSide = () => {
    setFlipping(true);
    window.setTimeout(() => setFlipping(false), 320);
    setSide((s) => (s === "front" ? "back" : "front"));
    setSelectedId(null);
  };

  const shareDesign = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${product.name} design`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice({ tone: "ok", text: "Design link copied to your clipboard." });
    } catch {
      // The user dismissed the share sheet; nothing to report.
    }
  };

  const addText = () => {
    const layer = newTextLayer();
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], layer] }));
    setSelectedId(layer.id);
    setNotice({ tone: "ok", text: "Text added. Edit it in the panel." });
  };

  const addTextAndOpen = () => {
    addText();
    setTool("text");
    setPanelOpen(true);
  };

  const addArt = (item: ArtItem) => {
    const layer = newImageLayer(item.src, item.name);
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], layer] }));
    setSelectedId(layer.id);
    setNotice({ tone: "ok", text: `${item.name} added to the ${side}.` });
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
        text: check.warning ?? `Added at ${decoded.width} × ${decoded.height}px. Drag the handles to fit.`,
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

  /** Updates the roster and mirrors the first entry onto any name/number layers. */
  const commitRoster = (next: RosterEntry[]) => {
    setRoster(next);
    const first = next[0];
    setDesign((prev) => {
      const back = prev.back.map((l) => {
        if (l.type !== "text") return l;
        if (l.role === "name") return { ...l, text: first?.name || "NAME" };
        if (l.role === "number") return { ...l, text: first?.number || "00" };
        return l;
      });
      return { ...prev, back };
    });
  };

  const addRosterRow = () => commitRoster([...roster, { id: uid(), name: "", number: "" }]);
  const updateRoster = (id: string, patchRow: Partial<RosterEntry>) =>
    commitRoster(roster.map((e) => (e.id === id ? { ...e, ...patchRow } : e)));
  const removeRoster = (id: string) => commitRoster(roster.filter((e) => e.id !== id));

  const addNamesNumbers = () => {
    const first = roster[0] ?? { name: "NAME", number: "00" };
    const nameLayer = newTextLayer({
      role: "name",
      text: first.name || "NAME",
      x: 50,
      y: 30,
      fontSize: 7,
      font: nnStyle.font,
      color: nnStyle.color,
      strokeColor: nnStyle.strokeColor,
      strokeWidth: nnStyle.strokeWidth,
      uppercase: true,
      weight: 700,
    });
    const numLayer = newTextLayer({
      role: "number",
      text: first.number || "00",
      x: 50,
      y: 62,
      fontSize: 22,
      font: nnStyle.font,
      color: nnStyle.color,
      strokeColor: nnStyle.strokeColor,
      strokeWidth: nnStyle.strokeWidth,
      weight: 900,
    });
    setDesign((prev) => ({
      ...prev,
      back: [
        ...prev.back.filter((l) => l.type !== "text" || !l.role),
        nameLayer,
        numLayer,
      ],
    }));
    setSide("back");
    setSelectedId(numLayer.id);
    setNotice({ tone: "ok", text: "Names & numbers added to the back." });
  };

  const undo = () => {
    const h = historyRef.current;
    if (h.length < 2) return;
    const current = h[h.length - 1];
    const prev = h[h.length - 2];
    futureRef.current = [current, ...futureRef.current].slice(0, 30);
    historyRef.current = h.slice(0, -1);
    applyingHistory.current = true;
    setDesign(prev);
    setSelectedId(null);
    syncHist();
  };

  const redo = () => {
    const f = futureRef.current;
    if (!f.length) return;
    const next = f[0];
    futureRef.current = f.slice(1);
    historyRef.current = [...historyRef.current, next].slice(-30);
    applyingHistory.current = true;
    setDesign(next);
    setSelectedId(null);
    syncHist();
  };

  const startOver = () => {
    applyingHistory.current = true;
    historyRef.current = [...historyRef.current, emptyDesign()].slice(-30);
    futureRef.current = [];
    setDesign(emptyDesign());
    setSelectedId(null);
    syncHist();
  };

  const saveDraft = () => {
    const entry: SavedDraft = {
      id: `d-${Date.now().toString(36)}`,
      productSlug: product.slug,
      productName: product.name,
      colorSlug: mockup.slug,
      colorName: mockup.name,
      colorHex: mockup.hex,
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
    applyingHistory.current = true;
    setDesign(normalizeDesign(found.design));
    setSelectedId(null);
    const m = mockupForColor(found.colorName, found.colorHex);
    if (m) setColorCode(m.code);
    setNotice({ tone: "ok", text: `Loaded your saved ${found.productName} design.` });
  };

  const deleteDraft = (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    persistDrafts(next);
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
      setNotice({ tone: "warn", text: "No artwork added — this shirt will be added blank." });
    }

    setBusy(true);
    try {
      const previews = await drawPreview(mockup.front, mockup.back, design);
      addItem({
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        productKind: product.kind,
        colorSlug: mockup.slug,
        colorName: mockup.name,
        colorHex: mockup.hex,
        sidesUsed: sides,
        design,
        roster: roster.length ? roster : undefined,
        previewFront: previews.front,
        previewBack: previews.back,
        lines: sizeLines.filter((l) => l.qty > 0),
        surcharges: Object.fromEntries(product.sizes.map((sz) => [sz.label, sz.surcharge])),
        unitPrice: quote.unitBase,
        total: quote.total,
        quantity,
      });
      setAddedCount((n) => n + 1);
      setNotice({ tone: "ok", text: "Added to cart." });
      applyingHistory.current = true;
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

  function goNext() {
    if (step === "design" && quantity <= 0) {
      setNotice({ tone: "warn", text: "Set a quantity before reviewing." });
    }
    if (stepIndex < STEP_ORDER.length - 1) setStep(STEP_ORDER[stepIndex + 1]);
    setPanelOpen(true);
  }

  function goBack() {
    if (stepIndex > 0) setStep(STEP_ORDER[stepIndex - 1]);
    setPanelOpen(true);
  }

  /** Inspector shared by the Text and Layers tools. */
  function renderInspector() {
    if (!selected) {
      return <p className="empty-note small muted">Select a layer on the shirt to edit it.</p>;
    }

    const body =
      selected.type === "text" ? (
        <TextPanel
          layer={selected}
          inks={INK_COLORS}
          onChange={(changes) => patchActive(selected.id, changes)}
        />
      ) : (
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
      );

    const id = selected.id;
    return (
      <>
        {body}
        <LayerActions
          flipH={selected.flipH}
          flipV={selected.flipV}
          onCenter={() => patchActive(id, { x: 50, y: 50 })}
          onBackward={() => setDesign((prev) => reorderLayer(prev, side, id, "backward"))}
          onForward={() => setDesign((prev) => reorderLayer(prev, side, id, "forward"))}
          onFlipH={() => patchActive(id, { flipH: !selected.flipH })}
          onFlipV={() => patchActive(id, { flipV: !selected.flipV })}
          onDuplicate={() => {
            const res = duplicateLayer(design, side, id);
            if (res) {
              setDesign(res.design);
              setSelectedId(res.id);
            }
          }}
          onDelete={() => {
            setDesign((prev) => removeLayer(prev, side, id));
            setSelectedId(null);
          }}
        />
      </>
    );
  }

  return (
    <div className="studio">
      {/* Mobile app bar (ROT-style): brand, price, save, cart, primary action */}
      <div className="studio-appbar">
        <Link href="/" className="studio-appbar-brand" aria-label="Kingdom Custom Print — home">
          <Image
            src="/brand/kingdom-logo.png"
            alt="Kingdom Custom Print"
            width={1400}
            height={843}
            loading="eager"
          />
        </Link>

        <div className="studio-appbar-actions">
          <span className="studio-appbar-price tnum">
            {formatUSD(quote.unitBase)}
            <small> ea</small>
          </span>
          <button
            type="button"
            className="studio-appbar-btn"
            onClick={saveDraft}
            aria-label="Save design"
          >
            <SaveGlyph />
            <span className="studio-appbar-btn-label">Save</span>
          </button>
          <Link
            href="/cart"
            className="studio-appbar-btn"
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
          >
            <CartIcon />
            {cartCount > 0 ? <span className="studio-top-badge tnum">{cartCount}</span> : null}
          </Link>
          {step === "review" ? (
            <button
              type="button"
              className="studio-appbar-primary"
              onClick={handleAddToCart}
              disabled={busy}
            >
              {busy ? "Adding…" : addedCount > 0 ? "Add another" : "Add to cart"}
            </button>
          ) : (
            <button type="button" className="studio-appbar-primary" onClick={goNext}>
              Next
            </button>
          )}
        </div>
      </div>

      {/* Top bar: steps + cart */}
      <div className="studio-top">
        <button
          type="button"
          className="studio-back"
          onClick={goBack}
          disabled={stepIndex === 0}
          aria-label="Previous step"
        >
          <BackGlyph />
        </button>
        <ol className="studio-steps">
          {STEP_ORDER.map((key, i) => {
            const active = step === key;
            const done = stepIndex > i;
            return (
              <li key={key}>
                <button
                  type="button"
                  className={`studio-step${active ? " is-active" : ""}${done ? " is-done" : ""}`}
                  aria-current={active ? "step" : undefined}
                  onClick={() => {
                    setStep(key);
                    setPanelOpen(true);
                  }}
                >
                  <span className="studio-step-n tnum">{i + 1}</span>
                  <span className="studio-step-label">{STEP_LABEL[key]}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="studio-top-side">
          <Link href="/cart" className="studio-top-link">
            <CartIcon />
            <span>Cart</span>
            {cartCount > 0 ? <span className="studio-top-badge tnum">{cartCount}</span> : null}
          </Link>
          <Link href="/contact" className="studio-top-link studio-top-help">
            Need help?
          </Link>
        </div>
      </div>

      <div className="studio-main">
        {/* Tool rail */}
        {step === "design" ? (
          <nav className="studio-rail" aria-label="Design tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`studio-rail-btn${tool === t.id ? " is-active" : ""}`}
                onClick={() => openTool(t.id)}
                aria-pressed={tool === t.id}
              >
                <span className="studio-rail-icon" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="studio-rail-label">{t.label}</span>
              </button>
            ))}
          </nav>
        ) : null}

        {/* Scrim + contextual panel (bottom sheet on mobile) */}
        {panelOpen ? (
          <button
            type="button"
            className="studio-scrim"
            aria-label="Close panel"
            onClick={() => setPanelOpen(false)}
          />
        ) : null}
        <aside className={`studio-panel${panelOpen ? " is-open" : ""}`} aria-label="Design controls">
          <div className="studio-sheet-head">
            <span className="studio-sheet-grip" aria-hidden="true" />
            <button
              type="button"
              className="studio-sheet-close"
              onClick={() => setPanelOpen(false)}
              aria-label="Close panel"
            >
              <CloseGlyph />
            </button>
          </div>
          {notice ? (
            <p
              className={`cust-notice is-${notice.tone} studio-notice`}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.text}
            </p>
          ) : null}

          {step === "design" && tool === "products" ? (
            <>
              <PanelHead
                eyebrow="Products"
                title="Pick a blank & colour"
                hint="Choose the shirt, then a colour. The preview swaps to that exact garment."
              />

              <div className="studio-product">
                <div className="studio-product-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mockup.front} alt="" className="studio-product-img" />
                </div>
                <div className="studio-product-info">
                  <p className="studio-product-name wrap-anywhere">{product.name}</p>
                  {product.styleCode ? (
                    <p className="small muted">Style {product.styleCode}</p>
                  ) : null}
                  <p className="studio-product-color small">
                    <span className="studio-dot" style={{ background: mockup.hex }} aria-hidden="true" />
                    {mockup.name}
                  </p>
                </div>
              </div>

              <div className="pane">
                <p className="label">
                  Colour <span className="opt-value">{mockup.name}</span>
                </p>
                <div className="swatches swatches-lg">
                  {TEE_MOCKUPS.map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      className={`swatch${m.code === mockup.code ? " is-active" : ""}`}
                      style={{ background: m.hex }}
                      onClick={() => setColorCode(m.code)}
                      aria-pressed={m.code === mockup.code}
                      title={m.name}
                    >
                      <span className="sr-only">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pane">
                <p className="label">Switch blank</p>
                <div className="studio-blank-row">
                  {products.map((p) => (
                    <Link
                      key={p.id}
                      href={`/customize/${p.slug}`}
                      className={`studio-blank${p.id === product.id ? " is-active" : ""}`}
                      aria-current={p.id === product.id ? "true" : undefined}
                    >
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0].url} alt="" />
                      ) : (
                        <Image src="/brand/kingdom-logo.png" alt="" width={40} height={24} />
                      )}
                      <span className="wrap-anywhere">{p.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {step === "design" && tool === "text" ? (
            <>
              <PanelHead
                eyebrow="Add text"
                title="Type your message"
                hint={`Adds to the ${side}. Drag it to move, then use the round handles to stretch, rotate, resize or edit.`}
              />
              <button type="button" className="btn btn-block" onClick={addText}>
                + Add a text layer
              </button>
              <div className="pane">{renderInspector()}</div>
            </>
          ) : null}

          {step === "design" && tool === "upload" ? (
            <>
              <PanelHead
                eyebrow="Upload art"
                title="Add your artwork"
                hint="PNG, JPG, WEBP or SVG up to 8 MB. Vector prints sharpest — outline fonts first."
              />
              <button
                type="button"
                className="btn btn-block"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                {busy ? "Reading…" : "Choose a file"}
              </button>
              <p className="hint">It is placed on the {side} and can be moved, resized and flipped.</p>
            </>
          ) : null}

          {step === "design" && tool === "art" ? (
            <>
              <PanelHead
                eyebrow="Clipart"
                title="Ready-made graphics"
                hint="Drop in a graphic, then resize, rotate, flip and fade it like any layer."
              />
              <ul className="studio-art-grid">
                {ART_LIBRARY.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => addArt(item)} title={item.name}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.src} alt="" />
                      <span>{item.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {step === "design" && tool === "names" ? (
            <>
              <PanelHead
                eyebrow="Names & numbers"
                title="Add team names & numbers"
                hint="Set the style, then build a roster. Each shirt can print its own name and number."
              />

              <div className="field">
                <label className="label" htmlFor="nn-font">
                  Font
                </label>
                <select
                  id="nn-font"
                  className="select"
                  value={nnStyle.font}
                  onChange={(e) => setNnStyle((s) => ({ ...s, font: e.target.value }))}
                >
                  {FONTS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <span className="label">Ink colour</span>
                <div className="swatches">
                  {INK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`swatch${c.toLowerCase() === nnStyle.color.toLowerCase() ? " is-active" : ""}`}
                      style={{ background: c }}
                      onClick={() => setNnStyle((s) => ({ ...s, color: c }))}
                      aria-pressed={c.toLowerCase() === nnStyle.color.toLowerCase()}
                      title={c}
                    >
                      <span className="sr-only">{c}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="label">
                  Outline <span className="opt-value">{nnStyle.strokeWidth > 0 ? `${nnStyle.strokeWidth}%` : "Off"}</span>
                </span>
                <div className="swatches">
                  {["#FFFFFF", "#141414", "#C8102E", "#E8A317", "#1C6B45", "#26314C"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`swatch${c.toLowerCase() === nnStyle.strokeColor.toLowerCase() ? " is-active" : ""}`}
                      style={{ background: c }}
                      onClick={() => setNnStyle((s) => ({ ...s, strokeColor: c }))}
                      aria-pressed={c.toLowerCase() === nnStyle.strokeColor.toLowerCase()}
                      title={c}
                    >
                      <span className="sr-only">{c}</span>
                    </button>
                  ))}
                </div>
                <label className="range-row" htmlFor="nn-stroke">
                  <span>Width</span>
                  <input
                    id="nn-stroke"
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={nnStyle.strokeWidth}
                    onChange={(e) => setNnStyle((s) => ({ ...s, strokeWidth: Number(e.target.value) }))}
                  />
                  <span className="tnum small">{nnStyle.strokeWidth}</span>
                </label>
              </div>

              <div className="field">
                <span className="label">
                  Roster <span className="opt-value">{roster.length || "none"}</span>
                </span>
                {roster.length ? (
                  <ul className="roster-list">
                    {roster.map((entry) => (
                      <li key={entry.id}>
                        <input
                          className="input"
                          value={entry.name}
                          placeholder="Name"
                          onChange={(e) => updateRoster(entry.id, { name: e.target.value })}
                          aria-label="Player name"
                        />
                        <input
                          className="input roster-num"
                          value={entry.number}
                          placeholder="00"
                          inputMode="numeric"
                          onChange={(e) => updateRoster(entry.id, { number: e.target.value })}
                          aria-label="Player number"
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => removeRoster(entry.id)}
                          aria-label="Remove row"
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
                ) : (
                  <p className="empty-note small muted">No players yet. Add a row to start a roster.</p>
                )}
                <button type="button" className="btn btn-light btn-block" onClick={addRosterRow}>
                  + Add player
                </button>
              </div>

              <button type="button" className="btn btn-block" onClick={addNamesNumbers}>
                Add names & numbers to the back
              </button>
            </>
          ) : null}

          {step === "design" && tool === "layers" ? (
            <>
              <PanelHead
                eyebrow="Layers"
                title={`${side === "front" ? "Front" : "Back"} elements`}
                hint="Select a layer to edit it, then use the handles on the shirt or the actions below to reorder, flip, duplicate or delete."
              />
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
                  Nothing on this side yet. Use Text, Upload, Clipart or Names.
                </p>
              ) : null}
              <div className="pane">{renderInspector()}</div>
            </>
          ) : null}

          {step === "quantity" ? (
            <>
              <PanelHead
                eyebrow="Step 2"
                title="Quantity & sizes"
                hint="Enter quantities per size. The price drops as the run crosses a break."
              />
              <div className="size-run">
                {product.sizes.map((s) => (
                  <div
                    key={s.label}
                    className={`size-cell${(lines[s.label] ?? 0) > 0 ? " has-qty" : ""}`}
                  >
                    <label htmlFor={`c-qty-${s.label}`} className="size-label">
                      {s.label}
                      {s.surcharge > 0 ? <span className="size-add">+{formatUSD(s.surcharge)}</span> : null}
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
            </>
          ) : null}

          {step === "review" ? (
            <>
              <PanelHead
                eyebrow="Step 3"
                title="Review your order"
                hint="Check the design and the size run, then add it to the cart."
              />
              <ul className="review-list">
                <li>
                  <span>Blank</span>
                  <strong>{product.name}</strong>
                </li>
                <li>
                  <span>Colour</span>
                  <strong>{mockup.name}</strong>
                </li>
                <li>
                  <span>Printed sides</span>
                  <strong>
                    {sides.length
                      ? sides.map((s) => (s === "front" ? "Front" : "Back")).join(" + ")
                      : "Blank shirt"}
                  </strong>
                </li>
                <li>
                  <span>Elements</span>
                  <strong>{design.front.length + design.back.length || "None"}</strong>
                </li>
                {roster.length ? (
                  <li>
                    <span>Roster</span>
                    <strong className="tnum">{roster.length} names</strong>
                  </li>
                ) : null}
                <li>
                  <span>Shirts</span>
                  <strong className="tnum">{quantity}</strong>
                </li>
                <li>
                  <span>Price each</span>
                  <strong className="tnum">{formatUSD(quote.unitBase)}</strong>
                </li>
                <li className="review-total">
                  <span>Subtotal</span>
                  <strong className="tnum">{formatUSD(quote.total)}</strong>
                </li>
              </ul>

              {drafts.length ? (
                <div className="drafts">
                  <p className="eyebrow">Saved designs</p>
                  <ul>
                    {drafts.map((d) => (
                      <li key={d.id}>
                        <button type="button" className="draft-load" onClick={() => loadDraft(d.id)}>
                          <span className="draft-dot" style={{ background: d.colorHex }} aria-hidden="true" />
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

          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => onUpload(e.target.files?.[0])}
            className="sr-only"
            aria-label="Upload artwork file"
          />
        </aside>

        {/* Stage */}
        <section className="studio-stage" aria-label="Design preview">
          <div
            className={`stage-canvas${flipping ? " is-flipping" : ""}`}
            style={{ ["--stage-zoom" as string]: `${zoom}` }}
          >
            <div className="stage-tools" role="group" aria-label="History">
              <button type="button" onClick={undo} disabled={!hist.canUndo} aria-label="Undo">
                <UndoGlyph />
              </button>
              <button type="button" onClick={redo} disabled={!hist.canRedo} aria-label="Redo">
                <RedoGlyph />
              </button>
              <button type="button" onClick={startOver} aria-label="Start over">
                <ResetGlyph />
              </button>
            </div>

            <button
              type="button"
              className="stage-rotate"
              onClick={rotateSide}
              aria-label={`Rotate to the ${side === "front" ? "back" : "front"}`}
            >
              <span className="stage-rotate-icon" aria-hidden="true">
                <RotateTeeGlyph />
              </span>
              <span className="stage-rotate-label">Rotate</span>
              <span className="stage-rotate-side">{side === "front" ? "Front" : "Back"}</span>
            </button>

            <DesignCanvas
              frontSrc={mockup.front}
              backSrc={mockup.back}
              side={side}
              design={design}
              selectedId={selectedId}
              onSelect={handleSelect}
              onChange={patch}
              onCommit={() => undefined}
              onDelete={(id) => {
                setDesign((prev) => removeLayer(prev, side, id));
                if (selectedId === id) setSelectedId(null);
              }}
              onEdit={editLayer}
            />

            {layers.length === 0 ? (
              <div className="stage-add" role="group" aria-label="Add to your design">
                <button type="button" onClick={addTextAndOpen}>
                  <TextGlyph />
                  <span>Add text</span>
                </button>
                <button type="button" onClick={() => openTool("upload")}>
                  <UploadGlyph />
                  <span>Upload art</span>
                </button>
                <button type="button" onClick={() => openTool("art")}>
                  <ArtGlyph />
                  <span>Add art</span>
                </button>
                <button type="button" onClick={() => openTool("names")}>
                  <NamesGlyph />
                  <span>Names &amp; numbers</span>
                </button>
              </div>
            ) : null}

            <button
              type="button"
              className="stage-share"
              onClick={shareDesign}
              aria-label="Share this design"
            >
              <ShareGlyph />
              <span>Share</span>
            </button>
          </div>

          <div className="stage-zoom">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, Math.round((z - 0.15) * 100) / 100))}
              aria-label="Zoom out"
            >
              &minus;
            </button>
            <span className="tnum small">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.6, Math.round((z + 0.15) * 100) / 100))}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        </section>
      </div>

      {/* Bottom action bar */}
      <div className="studio-footer">
        <div className="studio-price">
          <span className="studio-price-unit tnum">
            {formatUSD(quote.unitBase)}
            <small> each</small>
          </span>
          <span className="studio-price-total small muted">
            {quantity > 0
              ? `${quantity} shirt${quantity === 1 ? "" : "s"} · ${formatUSD(quote.total)}`
              : "Set a quantity to see the total"}
          </span>
        </div>

        <div className="studio-footer-actions">
          {stepIndex > 0 ? (
            <button type="button" className="btn btn-light" onClick={goBack}>
              Back
            </button>
          ) : null}
          <button type="button" className="btn btn-light" onClick={saveDraft}>
            Save design
          </button>
          {step === "review" ? (
            <button type="button" className="btn btn-red" onClick={handleAddToCart} disabled={busy}>
              {busy ? "Adding…" : addedCount > 0 ? "Add another" : "Add to cart"}
            </button>
          ) : (
            <button type="button" className="btn" onClick={goNext}>
              Next step
            </button>
          )}
          {addedCount > 0 ? (
            <Link href="/cart" className="btn btn-light">
              Go to cart ({addedCount})
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PanelHead({ eyebrow, title, hint }: { eyebrow: string; title: string; hint: string }) {
  return (
    <header className="studio-panel-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="h3 studio-panel-title">{title}</h2>
      <p className="small muted">{hint}</p>
    </header>
  );
}

function LayerActions({
  flipH,
  flipV,
  onCenter,
  onBackward,
  onForward,
  onFlipH,
  onFlipV,
  onDuplicate,
  onDelete,
}: {
  flipH: boolean;
  flipV: boolean;
  onCenter: () => void;
  onBackward: () => void;
  onForward: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="layer-actions" role="group" aria-label="Layer actions">
      <button type="button" onClick={onCenter}>
        <CenterGlyph />
        <span>Center</span>
      </button>
      <div className="layer-actions-split">
        <button type="button" onClick={onBackward} aria-label="Send backward">
          <OrderDownGlyph />
        </button>
        <button type="button" onClick={onForward} aria-label="Bring forward">
          <OrderUpGlyph />
        </button>
      </div>
      <div className="layer-actions-split">
        <button
          type="button"
          className={flipH ? "is-on" : ""}
          aria-pressed={flipH}
          onClick={onFlipH}
          aria-label="Flip horizontal"
        >
          <FlipHGlyph />
        </button>
        <button
          type="button"
          className={flipV ? "is-on" : ""}
          aria-pressed={flipV}
          onClick={onFlipV}
          aria-label="Flip vertical"
        >
          <FlipVGlyph />
        </button>
      </div>
      <button type="button" onClick={onDuplicate}>
        <DupGlyph />
        <span>Duplicate</span>
      </button>
      <button type="button" className="is-danger" onClick={onDelete}>
        <TrashGlyph />
        <span>Delete</span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------
   Rail glyphs
   ------------------------------------------------------------------------- */

function ProductsGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 3 5 5.2 3.4 9.6l2.8 1 .8 9.4h10l.8-9.4 2.8-1L19 5.2 15 3a3 3 0 0 1-6 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TextGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6V4h16v2M12 4v16M8 20h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArtGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.6" cy="8.6" r="1.6" fill="currentColor" />
      <path
        d="m5 17 4.6-4.4L13 15.4l2.4-2.2L19 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NamesGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h10M4 11h7M4 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M16 20c0-2.2 1.6-3.6 3.5-3.6S23 17.8 23 20M19.5 13.4a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LayersGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="m3 13 9 5 9-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 3.5h10.5L20.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7.5 3.5v5h7v-5M7.5 20.5v-5h9v5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function BackGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 5.5 8.5 12l6.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UndoGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 7H5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 11a8 8 0 1 1 2.4 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RedoGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 7h4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 11a8 8 0 1 0-2.4 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ResetGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.4 10a8 8 0 1 1-1 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="18" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="19" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="m8.3 10.7 7.4-4.4M8.3 13.3l7.4 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function RotateTeeGlyph() {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M14 7 9 9.5 7 14l3 1.2.6 6.8h18.8l.6-6.8 3-1.2-2-4.5L26 7a6 6 0 0 1-12 0Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 27a12 12 0 0 0 20 4.5" stroke="#2f7bff" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="m29.5 31.5.6-4.6-4.6.6"
        stroke="#2f7bff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M31 27a12 12 0 0 0-20-4.5" stroke="#2f7bff" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="m10.5 22.5-.6 4.6 4.6-.6"
        stroke="#2f7bff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CenterGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function OrderUpGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V6m0 0-5 5m5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OrderDownGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v13m0 0-5-5m5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlipHGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 6 4 12l5 6V6ZM15 6l5 6-5 6V6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function FlipVGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M6 9 12 4l6 5H6ZM6 15l6 5 6-5H6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function DupGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
