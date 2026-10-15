"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import DesignCanvas, { printAreaView } from "./DesignCanvas";
import { fitStage } from "./stageGeometry";
import {
  ArtPanel,
  AddTextPanel,
  TextIdeasPanel,
  DistressPanel,
  LayersPanel,
  NamesIntro,
  NamesTools,
  NN_DEFAULTS,
  ProductsPanel,
  ProductSwitchConfirmPanel,
  QuantityPanel,
  ReviewPanel,
  RosterEditor,
  SavedPanel,
  TemplatesPanel,
  type NNSettings,
  type NNSize,
} from "./panels";
import { ImageEditor, TextEditor, type LayerActionsProps } from "./editors";
import {
  ArtIcon,
  CartGlyph,
  CheckGlyph,
  CloseIcon,
  CloudUploadIcon,
  DistressIcon,
  ChevronRightIcon,
  DollarIcon,
  DuplicateIcon,
  GroupIcon,
  HeadsetIcon,
  LayersIcon,
  LockIcon,
  PersonalizeIcon,
  RedoIcon,
  RotateShirtIcon,
  SaveIcon,
  ShareIcon,
  ShirtIcon,
  TextBoxIcon,
  TemplatesIcon,
  TrashIcon,
  UndoIcon,
  UngroupIcon,
  UserIcon,
} from "./icons";
import { type ArtItem, ART_LIBRARY } from "./art";
import type { DesignTemplate } from "./templates";
import {
  duplicateLayer,
  duplicateSelection,
  emptyDesign,
  groupMembers,
  groupSelection,
  loadDrafts,
  newImageLayer,
  newTextLayer,
  normalizeDesign,
  persistDrafts,
  personalizationOf,
  readImageFile,
  removeLayers,
  reorderLayer,
  selectionIds,
  selectionIsWholeGroup,
  ungroupSelection,
  updateLayer,
  usedSides,
  validateUpload,
  type SavedDraft,
} from "@/lib/design";
import { applyImageFx, DEFAULT_FX, isVectorSource, quickBackgroundRemoval } from "@/lib/imageFx";
import { removeBackgroundLocally, type BackgroundRemovalProgress } from "@/lib/backgroundRemoval";
import { drawPreview } from "./preview";
import { mockupByCode, mockupsForProduct, TEE_MOCKUPS, type TeeMockup } from "@/lib/mockups";
import { useCart } from "@/lib/cart-context";
import { quoteProduct, formatUSD } from "@/lib/pricing";
import type {
  Design,
  DesignLayer,
  GarmentSide,
  ImageFx,
  ImageLayer,
  Product,
  RosterEntry,
  SizeLine,
  TextLayer,
} from "@/lib/types";

type Step = "design" | "quantity" | "review";
type Panel =
  | "none"
  | "products"
  | "switch-confirm"
  | "upload"
  | "text"
  | "text-add"
  | "image"
  | "art"
  | "templates"
  | "ideas"
  | "names-intro"
  | "names"
  | "roster"
  | "distress"
  | "layers"
  | "saved";

const STEP_ORDER: Step[] = ["design", "quantity", "review"];
const STEP_LABEL: Record<Step, string> = {
  design: "Design",
  quantity: "Quantity & sizes",
  review: "Review",
};

/** Layer editors share selection state; all design panels keep a mobile preview visible. */
const SPLIT_PANELS: Panel[] = ["text", "image"];

/**
 * Background removal runs instantly on-device everywhere. The AI model is an
 * optional refinement for busy photos: it only runs on desktop-class browsers,
 * because the ~180 MB model download is far too heavy for a phone. The check
 * comes first so a phone that happens to expose WebGPU is still skipped.
 */
function shouldRefineWithAi(): boolean {
  if (typeof navigator === "undefined") return false;
  return !/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || "");
}

const NN_FONT_SIZES: Record<NNSize, { name: number; number: number; sub: number }> = {
  small: { name: 4.5, number: 12, sub: 3.2 },
  medium: { name: 6, number: 18, sub: 4 },
  large: { name: 7.5, number: 26, sub: 4.6 },
};

interface DraftState {
  colorCode: string;
  design: Design;
  lines: Record<string, number>;
  roster: RosterEntry[];
  nn: NNSettings;
}

interface ProductHandoff extends DraftState {
  targetSlug: string;
  colorSlug: string;
  colorName: string;
  colorHex: string;
  notice?: string;
}

interface ProductSwitchPrompt {
  target: Product;
  unavailableLines: { label: string; qty: number }[];
  rosterCount: number;
}

let pendingProductHandoff: ProductHandoff | null = null;

function colorForProduct(productMockups: TeeMockup[], value: string | undefined) {
  if (!value) return undefined;
  const exact = productMockups.find((item) => item.slug === value || item.code === value);
  if (exact) return exact;
  const legacySlug = mockupByCode(value)?.slug;
  return legacySlug ? productMockups.find((item) => item.slug === legacySlug) : undefined;
}

function closestProductColor(productMockups: TeeMockup[], hex: string) {
  const source = hex.replace("#", "").match(/../g)?.map((part) => Number.parseInt(part, 16));
  if (!source || source.length !== 3) return productMockups[0];
  return productMockups.reduce((closest, candidate) => {
    const rgb = candidate.hex.replace("#", "").match(/../g)?.map((part) => Number.parseInt(part, 16));
    if (!rgb || rgb.length !== 3) return closest;
    const distance = source.reduce((sum, channel, index) => sum + (channel - rgb[index]) ** 2, 0);
    return distance < closest.distance ? { item: candidate, distance } : closest;
  }, { item: productMockups[0], distance: Number.POSITIVE_INFINITY }).item;
}

const uid = () => `r-${Math.random().toString(36).slice(2, 9)}`;

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Drops editor-only data (original pixels, fx recipe) before the cart stores a design. */
function stripForCart(design: Design): Design {
  const clean = (layers: DesignLayer[]) =>
    layers.map((l) => {
      if (l.type !== "image") return l;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { origSrc, backgroundRemovedSrc, fx, ...rest } = l as ImageLayer;
      return rest as ImageLayer;
    });
  return { front: clean(design.front), back: clean(design.back) };
}

export default function Customizer({
  product,
  products,
  initialColor,
  initialLines,
  contactPhone,
}: {
  product: Product;
  products: Product[];
  initialColor: string;
  initialLines: Record<string, number>;
  contactPhone: string;
}) {
  const { addItem, items } = useCart();
  const router = useRouter();

  const productMockups = useMemo(() => mockupsForProduct(product), [product]);

  const [step, setStep] = useState<Step>("design");
  const [panel, setPanel] = useState<Panel>("none");
  const [side, setSide] = useState<GarmentSide>("front");
  const [colorCode, setColorCode] = useState(() => {
    const match = colorForProduct(productMockups, initialColor) ?? productMockups[0] ?? TEE_MOCKUPS[0];
    return match.code;
  });
  const [design, setDesign] = useState<Design>(emptyDesign);
  const [lines, setLines] = useState<Record<string, number>>(initialLines);
  /** The selection is a list: one layer, a whole group, or a multi-pick. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** While on, canvas taps add to and remove from the selection. */
  const [multiSelect, setMultiSelect] = useState(false);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [productSwitchPrompt, setProductSwitchPrompt] = useState<ProductSwitchPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [fxBusy, setFxBusy] = useState(false);
  const [fxStatus, setFxStatus] = useState<string | null>(null);
  const [fxProgress, setFxProgress] = useState<number | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [hist, setHist] = useState({ canUndo: false, canRedo: false });
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [nn, setNn] = useState<NNSettings>(NN_DEFAULTS);
  const [focusToken, setFocusToken] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [previews, setPreviews] = useState<{ front: string | null; back: string | null }>({
    front: null,
    back: null,
  });

  const fileInput = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const openFilePicker = useCallback(() => {
    fileInput.current?.click();
  }, []);
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  const [compact, setCompact] = useState(true);
  const [shortViewport, setShortViewport] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);

  const draftKey = `kcp.draft.v3.${product.slug}`;
  const [ready, setReady] = useState(false);
  const [restoredSlug, setRestoredSlug] = useState("");
  const historyRef = useRef<Design[]>([]);
  const futureRef = useRef<Design[]>([]);
  const applyingHistory = useRef(false);
  const restoredSlugRef = useRef<string | null>(null);

  const syncHist = useCallback(() => {
    setHist({
      canUndo: historyRef.current.length > 1,
      canRedo: futureRef.current.length > 0,
    });
  }, []);

  const mockup: TeeMockup = useMemo(
    () => productMockups.find((m) => m.code === colorCode) ?? productMockups[0] ?? TEE_MOCKUPS[0],
    [colorCode, productMockups]
  );
  const changeColor = useCallback((code: string) => {
    setColorCode(code);
  }, []);
  const darkShirt = luminance(mockup.hex) < 0.42;

  const sizeLines = useMemo<SizeLine[]>(
    () => product.sizes.map((s) => ({ label: s.label, qty: lines[s.label] ?? 0 })),
    [product.sizes, lines]
  );

  const quantity = sizeLines.reduce((n, l) => n + l.qty, 0);
  const sides = usedSides(design);
  const personalization = personalizationOf(design);
  const quote = quoteProduct(product, { sides, lines: sizeLines, personalization });
  const layers = design[side];
  // Panels and editors belong to one layer; a group or multi-pick has no editor.
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selected = selectedId ? layers.find((l) => l.id === selectedId) : undefined;
  const selectedLayers = useMemo(
    () => layers.filter((l) => selectedIds.includes(l.id)),
    [layers, selectedIds]
  );
  const cartCount = items.reduce((n, i) => n + i.quantity, 0);
  const rosterLocked = roster.length > 0 && personalization !== "none";

  /* ---- restore draft on mount ---- */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (restoredSlugRef.current === product.slug) return;
    restoredSlugRef.current = product.slug;
    setDrafts(loadDrafts());
    let restoredDesign: Design | null = null;
    try {
      const handoff = pendingProductHandoff;
      if (handoff?.targetSlug === product.slug && handoff.design?.front && handoff.design?.back) {
        restoredDesign = normalizeDesign(handoff.design);
        setDesign(restoredDesign);
        const transferredColor = productMockups.find((item) => item.slug === handoff.colorSlug);
        const matchingName = productMockups.find((item) => item.name.toLowerCase() === handoff.colorName.toLowerCase());
        setColorCode((transferredColor ?? matchingName ?? closestProductColor(productMockups, handoff.colorHex))?.code ?? TEE_MOCKUPS[0].code);
        setLines(Object.fromEntries(product.sizes.map((size) => [size.label, handoff.lines?.[size.label] ?? 0])));
        setRoster((handoff.roster ?? []).map((entry) => ({
          ...entry,
          size: product.sizes.some((size) => size.label === entry.size) ? entry.size : product.sizes[0]?.label,
        })));
        if (handoff.nn) setNn({ ...NN_DEFAULTS, ...handoff.nn });
        if (handoff.notice) setNotice({ tone: "warn", text: handoff.notice });
        pendingProductHandoff = null;
      } else {
        if (handoff) pendingProductHandoff = null;
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<DraftState>;
          if (parsed?.design?.front && parsed?.design?.back) {
            restoredDesign = normalizeDesign(parsed.design);
            setDesign(restoredDesign);
          }
          const requestedColor = colorForProduct(productMockups, initialColor);
          const savedColor = colorForProduct(productMockups, parsed?.colorCode);
          if (requestedColor) setColorCode(requestedColor.code);
          else if (savedColor) setColorCode(savedColor.code);
          if (Array.isArray(parsed?.roster)) setRoster(parsed.roster);
          if (parsed?.nn) setNn({ ...NN_DEFAULTS, ...parsed.nn });
          const fromUrl = Object.values(initialLines).some((n) => n > 0);
          if (!fromUrl && parsed?.lines) {
            setLines(Object.fromEntries(product.sizes.map((size) => [size.label, parsed.lines?.[size.label] ?? 0])));
          } else {
            setLines(Object.fromEntries(product.sizes.map((size) => [size.label, initialLines[size.label] ?? 0])));
          }
        }
        if (!colorForProduct(productMockups, initialColor)) {
          const first = productMockups[0];
          if (first) setColorCode(first.code);
        }
      }
    } catch {
      // A corrupt draft should not block the editor; start clean.
    }
    historyRef.current = [restoredDesign ?? emptyDesign()];
    futureRef.current = [];
    setHist({ canUndo: false, canRedo: false });
    setPanel("none");
    setStep("design");
    setRestoredSlug(product.slug);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, productMockups]);

  useEffect(() => {
    if (!ready || restoredSlug !== product.slug) return;
    const url = new URL(window.location.href);
    url.searchParams.set("color", mockup.slug);
    const encodedSizes = sizeLines.filter((line) => line.qty > 0).map((line) => `${line.label}:${line.qty}`).join(",");
    if (encodedSizes) url.searchParams.set("sizes", encodedSizes);
    else url.searchParams.delete("sizes");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [ready, restoredSlug, product.slug, mockup.slug, sizeLines]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* ---- autosave draft ---- */
  useEffect(() => {
    if (!ready || restoredSlug !== product.slug) return;
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ colorCode, design, lines, roster, nn } satisfies DraftState)
      );
    } catch {
      // Storage unavailable or full; the in-progress design still works.
    }
  }, [ready, restoredSlug, product.slug, draftKey, colorCode, design, lines, roster, nn]);

  /* Text entry is grouped; pointer gestures commit as one history step. */
  useEffect(() => {
    if (transforming) return;
    if (applyingHistory.current) {
      applyingHistory.current = false;
      return;
    }
    if (!historyRef.current.length) {
      historyRef.current = [design];
      syncHist();
      return;
    }
    if (historyRef.current.at(-1) === design) return;
    setHist({ canUndo: true, canRedo: false });
    const t = setTimeout(() => {
      historyRef.current = [...historyRef.current.slice(-29), design];
      futureRef.current = [];
      syncHist();
    }, 450);
    return () => clearTimeout(t);
  }, [design, syncHist, transforming]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(t);
  }, [notice]);

  /* ---- the studio is a full-screen app: lock the page behind it ---- */
  useEffect(() => {
    document.body.dataset.lock = "true";
    return () => {
      delete document.body.dataset.lock;
    };
  }, []);

  /* ---- measure the stage so the shirt can be fitted ---- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const mq = window.matchMedia("(max-width: 900px)");
    const mqShort = window.matchMedia("(max-height: 500px)");
    const read = () => {
      setCompact(mq.matches);
      setShortViewport(mqShort.matches);
      setStageBox({ w: el.clientWidth, h: el.clientHeight });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    mq.addEventListener("change", read);
    mqShort.addEventListener("change", read);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", read);
      mqShort.removeEventListener("change", read);
    };
  }, [step]);

  /* ---- the floating inspector's height, so the garment can pan around it ---- */
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const read = () => setPanelHeight(el.offsetHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---- review step: render the flattened previews ---- */
  useEffect(() => {
    if (step !== "review") return;
    let live = true;
    drawPreview(mockup.front, mockup.back, stripForCart(design), product.printArea)
      .then((p) => live && setPreviews(p))
      .catch(() => live && setPreviews({ front: null, back: null }));
    return () => {
      live = false;
    };
  }, [step, mockup, design, product.printArea]);

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

  /* ---- selection + panel routing ---- */
  const handleSelect = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    if (!ids.length) setPanel("none");
  }, []);

  const closePanel = () => {
    setSelectedIds([]);
    setPanel("none");
  };

  const openLayerPanel = (id: string) => {
    const layer = design[side].find((l) => l.id === id);
    if (!layer) return;
    setSelectedIds([id]);
    setPanel(layer.type === "text" ? "text" : "image");
  };

  /**
   * A tap on the canvas. A plain element opens its editor straight away, like
   * before. A grouped element is picked up as a whole group first (so it can be
   * moved as one object), and tapping it again steps inside the group and opens
   * that element's editor.
   */
  const handleTap = (id: string) => {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;

    if (multiSelect) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
      setPanel("none");
      return;
    }

    const groupIds = layer.groupId
      ? groupMembers(design, side, layer.groupId).map((l) => l.id)
      : [];
    const groupSelected =
      groupIds.length > 1 &&
      selectedIds.length === groupIds.length &&
      groupIds.every((gid) => selectedIds.includes(gid));

    if (groupIds.length > 1 && !groupSelected) {
      setSelectedIds(groupIds);
      setPanel("none");
      return;
    }
    openLayerPanel(id);
  };

  const editLayer = (id: string) => {
    openLayerPanel(id);
    setFocusToken((n) => n + 1);
  };

  const rotateSide = () => {
    setFlipping(true);
    window.setTimeout(() => setFlipping(false), 320);
    setSide((s) => (s === "front" ? "back" : "front"));
    setSelectedIds([]);
    setPanel((p) => (SPLIT_PANELS.includes(p) ? "none" : p));
  };

  const shareDesign = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const previews = await drawPreview(mockup.front, mockup.back, stripForCart(design), product.printArea);
      const preview = previews[side];
      if (!preview) throw new Error("No preview available");
      const blob = await (await fetch(preview)).blob();
      const file = new File([blob], `${product.slug}-${side}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ title: `${product.name} design`, files: [file] });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // Some browsers advertise file sharing but cannot open their share UI.
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ tone: "ok", text: "Design preview downloaded." });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setNotice({ tone: "error", text: "Could not create your preview. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  /* ---- adding things ---- */
  const addText = (style: Partial<TextLayer> = {}) => {
    const layer = newTextLayer({ ...(darkShirt ? { color: "#FFFFFF" } : {}), ...style });
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], layer] }));
    setSelectedIds([layer.id]);
    setPanel("text");
  };

  const addImageLayer = (src: string, name: string, aspect: number) => {
    const layer = newImageLayer(src, name, aspect, { origSrc: src, fx: { ...DEFAULT_FX } });
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], layer] }));
    setSelectedIds([layer.id]);
    setPanel("image");
  };

  const addArt = (item: ArtItem) => {
    addImageLayer(item.src, item.name, 1);
    setNotice({ tone: "ok", text: `${item.name} added to the ${side}.` });
  };

  const addTemplate = (template: DesignTemplate) => {
    const additions: DesignLayer[] = [];
    for (const element of template.elements) {
      if (element.type === "text") {
        additions.push(newTextLayer({
          ...element.layer,
          ...(darkShirt ? { color: "#FFFFFF" } : {}),
        }));
        continue;
      }

      const item = ART_LIBRARY.find((artItem) => artItem.id === element.layer.artId);
      if (!item) continue;
      const src = darkShirt && item.src.startsWith("data:image/svg+xml;utf8,")
        ? `data:image/svg+xml;utf8,${encodeURIComponent(decodeURIComponent(item.src.slice("data:image/svg+xml;utf8,".length)).replaceAll("#141414", "#FFFFFF"))}`
        : item.src;
      additions.push(newImageLayer(src, `Template: ${template.name} / ${item.name}`, 1, {
        x: element.layer.x,
        y: element.layer.y,
        scaleX: element.layer.scaleX,
        scaleY: element.layer.scaleY,
        origSrc: src,
        fx: { ...DEFAULT_FX },
      }));
    }

    if (!additions.length) return;
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], ...additions] }));
    setSelectedIds([]);
    setPanel("none");
    setNotice({ tone: "ok", text: `${template.name} added to the ${side}. Tap a part to edit it.` });
  };

  const onUpload = async (file: File | undefined) => {
    if (!file || busy || step !== "design") return;
    const check = validateUpload(file);
    if (!check.ok) {
      setNotice({ tone: "error", text: check.error ?? "That file cannot be used." });
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const decoded = await readImageFile(file);
      addImageLayer(decoded.dataUrl, file.name, decoded.width / decoded.height);
      if (check.warning) setNotice({ tone: "warn", text: check.warning });
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

  /* ---- image editing ---- */
  const applyFx = async (layer: ImageLayer, next: Partial<ImageFx>) => {
    const fx: ImageFx = { ...(layer.fx ?? DEFAULT_FX), ...next };
    const orig = layer.origSrc ?? layer.src;
    let backgroundRemovedSrc = layer.backgroundRemovedSrc;
    setFxBusy(true);
    setFxProgress(null);
    setFxStatus(fx.removeBg ? "Preparing background removal…" : "Applying artwork edits…");
    try {
      let removedNothing = false;
      if (fx.removeBg && !backgroundRemovedSrc) {
        // 1) Instant, on-device cutout — guaranteed to work on phones.
        setFxStatus("Removing background…");
        const quick = await quickBackgroundRemoval(orig).catch(() => null);
        if (quick) backgroundRemovedSrc = quick.dataUrl;

        // 2) Refine busy photos with the AI model on capable devices.
        const canRefine = shouldRefineWithAi() && !isVectorSource(orig);
        if (canRefine && !quick?.confident) {
          setFxStatus("Refining the cutout…");
          try {
            const refined = await removeBackgroundLocally(orig, (progress: BackgroundRemovalProgress) => {
              setFxStatus(
                progress.phase === "download"
                  ? "Downloading AI model…"
                  : progress.phase === "compatibility"
                    ? "Using compatibility mode; this may take longer…"
                    : "Refining the cutout…",
              );
              setFxProgress(progress.phase === "download" ? progress.percent ?? null : null);
            });
            backgroundRemovedSrc = refined;
          } catch {
            // Keep whatever the instant cutout produced — never block the user.
          }
        }
        if (!backgroundRemovedSrc) removedNothing = true;
      }
      setFxStatus("Applying artwork edits…");
      const source = fx.removeBg ? backgroundRemovedSrc ?? orig : orig;
      const res = await applyImageFx(source, { ...fx, removeBg: false });
      patch(side, layer.id, {
        fx,
        origSrc: orig,
        backgroundRemovedSrc,
        src: res.dataUrl,
        aspect: res.aspect,
      } as Partial<ImageLayer>);
      if (next.removeBg !== undefined) {
        setNotice(
          fx.removeBg
            ? removedNothing
              ? { tone: "warn", text: "We could not detect a background to remove. Try Select Object for busy photos." }
              : { tone: "ok", text: "Background removed." }
            : { tone: "ok", text: "Original background restored." },
        );
      }
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof Error ? err.message : "That edit could not be applied.",
      });
    } finally {
      setFxBusy(false);
      setFxStatus(null);
      setFxProgress(null);
    }
  };

  const resetImage = async (layer: ImageLayer) => {
    const orig = layer.origSrc ?? layer.src;
    setFxBusy(true);
    try {
      const res = await applyImageFx(orig, { ...DEFAULT_FX });
      patch(side, layer.id, {
        fx: { ...DEFAULT_FX },
        origSrc: orig,
        backgroundRemovedSrc: undefined,
        src: res.dataUrl,
        aspect: res.aspect,
        x: 50,
        y: 50,
        scaleX: 0.6,
        scaleY: 0.6,
        rotation: 0,
        opacity: 1,
        flipH: false,
        flipV: false,
      } as Partial<ImageLayer>);
    } catch {
      setNotice({ tone: "error", text: "Could not reset that artwork." });
    } finally {
      setFxBusy(false);
    }
  };

  /* ---- layer actions (shared by the editors and the group bar) ---- */
  const actionsFor = (layer: DesignLayer): LayerActionsProps => {
    const index = layers.findIndex((l) => l.id === layer.id);
    return {
      locked: Boolean(layer.locked),
      canBackward: index > 0,
      canForward: index >= 0 && index < layers.length - 1,
      flipH: layer.flipH,
      flipV: layer.flipV,
      onCenter: () => patchActive(layer.id, { x: 50, y: 50 }),
      onBackward: () => setDesign((prev) => reorderLayer(prev, side, layer.id, "backward")),
      onForward: () => setDesign((prev) => reorderLayer(prev, side, layer.id, "forward")),
      onFlipH: () => patchActive(layer.id, { flipH: !layer.flipH }),
      onFlipV: () => patchActive(layer.id, { flipV: !layer.flipV }),
      onLock: () => {
        // A group locks as one object, so the lock always means the same thing.
        const ids = layer.groupId
          ? groupMembers(design, side, layer.groupId).map((l) => l.id)
          : [layer.id];
        for (const id of ids) patchActive(id, { locked: !layer.locked });
      },
      onDelete: () => deleteLayers([layer.id]),
      onDuplicate: () => {
        const res = duplicateLayer(design, side, layer.id);
        if (res) {
          setDesign(res.design);
          setSelectedIds([res.id]);
        }
      },
    };
  };

  const deleteLayers = (ids: string[]) => {
    if (!ids.length) return;
    setDesign((prev) => removeLayers(prev, side, ids));
    if (ids.some((id) => selectedIds.includes(id))) {
      setSelectedIds([]);
      setPanel((p) => (SPLIT_PANELS.includes(p) ? "none" : p));
    }
  };

  /* ---- grouping: several layers that behave as one object ---- */
  const groupSelected = () => {
    if (selectedIds.length < 2) return;
    const count = selectedIds.length;
    setDesign((prev) => groupSelection(prev, side, selectedIds));
    setMultiSelect(false);
    setNotice({ tone: "ok", text: `${count} elements grouped. Move them as one.` });
  };

  const ungroupSelected = (ids: string[] = selectedIds) => {
    if (!ids.length) return;
    setDesign((prev) => ungroupSelection(prev, side, ids));
    if (ids.some((id) => selectedIds.includes(id))) setSelectedIds([]);
    setNotice({ tone: "ok", text: "Group released." });
  };

  const duplicateSelected = () => {
    if (!selectedIds.length) return;
    const res = duplicateSelection(design, side, selectedIds);
    if (!res) return;
    setDesign(res.design);
    setSelectedIds(res.ids);
  };

  /** True when every selected layer is locked (the bar then offers Unlock). */
  const allLocked = selectedLayers.length > 0 && selectedLayers.every((l) => l.locked);

  const toggleLockSelected = () => {
    const next = !allLocked;
    for (const id of selectedIds) patchActive(id, { locked: next });
    setNotice({ tone: "ok", text: next ? "Locked. Unlock to move again." : "Unlocked." });
  };

  /** Adds or removes one layer from the selection (Layers panel checkboxes). */
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setPanel("layers");
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setMultiSelect(false);
  };

  /* ---- distress ---- */
  const distressLevel = layers.reduce((n, l) => Math.max(n, l.distress ?? 0), 0);
  const setDistress = (level: number) => {
    setDesign((prev) => ({
      ...prev,
      [side]: prev[side].map((l) => ({ ...l, distress: level })),
    }));
  };

  /* ---- names & numbers ---- */
  const defaultSize = product.sizes.find((s) => s.label === "M")?.label ?? product.sizes[0]?.label ?? "M";
  const sizeLabels = product.sizes.map((s) => s.label);

  const syncLinesFromRoster = (rows: RosterEntry[]) => {
    const counts: Record<string, number> = Object.fromEntries(product.sizes.map((s) => [s.label, 0]));
    for (const r of rows) {
      const label = r.size && r.size in counts ? r.size : defaultSize;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    setLines(counts);
  };

  const mirrorFirstRow = (rows: RosterEntry[]) => {
    const first = rows[0];
    setDesign((prev) => {
      const remap = (list: DesignLayer[]) =>
        list.map((l) => {
          if (l.type !== "text") return l;
          if (l.role === "name") return { ...l, text: first?.name || "NAME" };
          if (l.role === "number") return { ...l, text: first?.number || "00" };
          if (l.role === "subtitle") return { ...l, text: first?.subtitle || "SUBTITLE" };
          return l;
        });
      return { front: remap(prev.front), back: remap(prev.back) };
    });
  };

  const commitRoster = (rows: RosterEntry[]) => {
    setRoster(rows);
    mirrorFirstRow(rows);
    syncLinesFromRoster(rows);
  };

  const startNames = () => {
    setSelectedIds([]);
    setPanel(personalization === "none" ? "names-intro" : "names");
  };

  const addTextIdeaLayers = (created: DesignLayer[], summary: string) => {
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], ...created] }));
    setSelectedIds([]);
    setPanel("none");
    setNotice({ tone: "ok", text: `Added ${summary}. You can edit each layer now.` });
  };

  const enterRoster = () => {
    if (!roster.length) {
      const seed = [{ id: uid(), name: "", number: "", subtitle: "", size: defaultSize }];
      setRoster(seed);
      syncLinesFromRoster(seed);
    }
    setPanel("roster");
  };

  const removeRole = (d: Design): Design => {
    const keep = (list: DesignLayer[]) => list.filter((l) => l.type !== "text" || !l.role);
    return { front: keep(d.front), back: keep(d.back) };
  };

  const finishRoster = () => {
    const rows = roster.length ? roster : [{ id: uid(), name: "", number: "", size: defaultSize }];
    const first = rows[0];
    const fs = NN_FONT_SIZES[nn.size];
    const ink = nn.color;
    const strokeColor = luminance(ink) > 0.5 ? "#141414" : "#FFFFFF";
    const common = { font: nn.font, color: ink, strokeColor, strokeWidth: 0, weight: 700 as const };
    const created: TextLayer[] = [];

    if (nn.names && nn.numbers) {
      created.push(
        newTextLayer({ ...common, role: "name", text: first.name || "NAME", y: 24, fontSize: fs.name })
      );
      created.push(
        newTextLayer({ ...common, role: "number", text: first.number || "00", y: 56, fontSize: fs.number, weight: 900 })
      );
    } else if (nn.names) {
      created.push(
        newTextLayer({ ...common, role: "name", text: first.name || "NAME", y: 30, fontSize: fs.name * 1.4 })
      );
    } else if (nn.numbers) {
      created.push(
        newTextLayer({ ...common, role: "number", text: first.number || "00", y: 45, fontSize: fs.number, weight: 900 })
      );
    }
    if (nn.names && nn.subtitles) {
      created.push(
        newTextLayer({
          ...common,
          role: "subtitle",
          text: first.subtitle || "SUBTITLE",
          y: nn.numbers ? 88 : 56,
          fontSize: fs.sub,
        })
      );
    }

    setDesign((prev) => {
      const cleaned = removeRole(prev);
      return { ...cleaned, [nn.side]: [...cleaned[nn.side], ...created] };
    });
    setRoster(rows);
    syncLinesFromRoster(rows);
    setSide(nn.side);
    setSelectedIds([]);
    setPanel("none");
    setNotice({
      tone: "ok",
      text: `${rows.length} ${rows.length === 1 ? "shirt" : "shirts"} added to your names & numbers list.`,
    });
  };

  const removeNames = () => {
    setDesign((prev) => removeRole(prev));
    setRoster([]);
    setNn(NN_DEFAULTS);
    setPanel("none");
    setNotice({ tone: "ok", text: "Names & numbers removed." });
  };

  const startOver = () => {
    setDesign(emptyDesign());
    setRoster([]);
    setSelectedIds([]);
    setPanel("none");
    setZoom(1);
    setNotice({ tone: "ok", text: "Started a fresh design." });
  };

  /* ---- history ---- */
  const undo = () => {
    const h = historyRef.current;
    const pending = h.at(-1) !== design;
    if (!h.length || (!pending && h.length < 2)) return;
    const current = design;
    const prev = h[h.length - (pending ? 1 : 2)];
    futureRef.current = [current, ...futureRef.current].slice(0, 30);
    historyRef.current = pending ? h : h.slice(0, -1);
    applyingHistory.current = true;
    setDesign(prev);
    setSelectedIds([]);
    setPanel((p) => (SPLIT_PANELS.includes(p) ? "none" : p));
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
    setSelectedIds([]);
    setPanel((p) => (SPLIT_PANELS.includes(p) ? "none" : p));
    syncHist();
  };

  /* ---- drafts ---- */
  const saveDraft = () => {
    const entry: SavedDraft = {
      id: `d-${Date.now().toString(36)}`,
      productSlug: product.slug,
      productName: product.name,
      colorSlug: mockup.slug,
      colorName: mockup.name,
      colorHex: mockup.hex,
      design,
      lines,
      roster,
      nn,
      savedAt: Date.now(),
    };
    const next = [entry, ...drafts].slice(0, 12);
    setDrafts(next);
    persistDrafts(next);
    setNotice({ tone: "ok", text: "Design saved to this device." });
  };

  const loadDraft = (id: string) => {
    const found = drafts.find((d) => d.id === id);
    if (!found) return;
    if (found.productSlug !== product.slug) {
      const target = products.find((item) => item.slug === found.productSlug);
      if (!target) {
        setNotice({ tone: "error", text: "That saved product is no longer in the catalog." });
        return;
      }
      const handoff: ProductHandoff = {
        targetSlug: target.slug,
        colorSlug: found.colorSlug,
        colorCode: found.colorSlug,
        colorName: found.colorName,
        colorHex: found.colorHex,
        design: normalizeDesign(found.design),
        lines: Object.fromEntries(target.sizes.map((size) => [size.label, found.lines?.[size.label] ?? 0])),
        roster: (found.roster ?? []).map((entry) => ({
          ...entry,
          size: target.sizes.some((size) => size.label === entry.size) ? entry.size : target.sizes[0]?.label,
        })),
        nn: found.nn ?? nn,
      };
      pendingProductHandoff = handoff;
      router.push(`/customize/${target.slug}`);
      return;
    }
    applyingHistory.current = true;
    setDesign(normalizeDesign(found.design));
    setSelectedIds([]);
    const m = productMockups.find((candidate) => candidate.slug === found.colorSlug);
    if (m) setColorCode(m.code);
    setLines(Object.fromEntries(product.sizes.map((size) => [size.label, found.lines?.[size.label] ?? 0])));
    setRoster(found.roster ?? []);
    if (found.nn) setNn({ ...NN_DEFAULTS, ...found.nn });
    setPanel("none");
    setNotice({ tone: "ok", text: `Loaded your saved ${found.productName} design.` });
  };

  const deleteDraft = (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    persistDrafts(next);
  };

  /* ---- quantity ---- */
  const setQty = (label: string, value: number) => {
    setLines((prev) => ({
      ...prev,
      [label]: Math.max(0, Math.min(999, Math.floor(Number(value) || 0))),
    }));
  };

  const fillAllInSize = (label: string) => {
    const total = quantity || 1;
    setLines(Object.fromEntries(product.sizes.map((s) => [s.label, s.label === label ? total : 0])));
  };

  const handleAddToCart = async () => {
    if (quantity <= 0) {
      setNotice({ tone: "error", text: "Set a quantity for at least one size first." });
      setStep("quantity");
      return;
    }
    if (personalization !== "none" && roster.every((r) => !r.name.trim() && !r.number.trim())) {
      setNotice({ tone: "warn", text: "Your names & numbers list is empty. Add names or numbers first." });
      setStep("design");
      setPanel("roster");
      return;
    }
    if (sides.length === 0) {
      setNotice({ tone: "warn", text: "No artwork added — this shirt will be added blank." });
    }

    setBusy(true);
    try {
      const cartDesign = stripForCart(design);
      const rendered = await drawPreview(mockup.front, mockup.back, cartDesign, product.printArea);
      addItem({
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        productKind: product.kind,
        colorSlug: mockup.slug,
        colorName: mockup.name,
        colorHex: mockup.hex,
        sidesUsed: sides,
        design: cartDesign,
        roster: roster.length ? roster : undefined,
        previewFront: rendered.front,
        previewBack: rendered.back,
        lines: sizeLines.filter((l) => l.qty > 0),
        surcharges: Object.fromEntries(product.sizes.map((sz) => [sz.label, sz.surcharge])),
        unitPrice: quote.unitBase,
        total: quote.total,
        quantity,
      });
      setAddedCount((n) => n + 1);
      setNotice({ tone: "ok", text: "Added to cart." });
      setLines(Object.fromEntries(product.sizes.map((s) => [s.label, 0])));
      setSelectedIds([]);
    } catch {
      setNotice({
        tone: "error",
        text: "We could not render a preview of that design. Try a smaller image.",
      });
    } finally {
      setBusy(false);
    }
  };

  /* ---- steps ---- */
  const stepIndex = STEP_ORDER.indexOf(step);

  const goStep = (next: Step) => {
    if (next === "review" && quantity < 1) {
      setNotice({ tone: "warn", text: "Choose at least one size and quantity first." });
      setStep("quantity");
      return;
    }
    setStep(next);
    setSelectedIds([]);
    setPanel("none");
  };

  const goNext = () => {
    if (step === "review") {
      void handleAddToCart();
      return;
    }
    goStep(STEP_ORDER[stepIndex + 1]);
  };

  const showPrice = () => {
    const text = quantity > 0
      ? `Estimated total for ${quantity} item${quantity === 1 ? "" : "s"}: ${formatUSD(quote.total)}.`
      : `Blank garments start at ${formatUSD(product.basePrice)}. Enter quantities to calculate your total.`;
    setNotice({ tone: "ok", text });
  };

  const applySubjectSelection = async (layer: ImageLayer, cutout: string) => {
    const orig = layer.origSrc ?? layer.src;
    const fx: ImageFx = { ...(layer.fx ?? DEFAULT_FX), removeBg: true };
    setFxBusy(true);
    setFxProgress(null);
    setFxStatus("Applying selected cutout…");
    try {
      const result = await applyImageFx(cutout, { ...fx, removeBg: false });
      patch(side, layer.id, {
        fx,
        origSrc: orig,
        backgroundRemovedSrc: cutout,
        src: result.dataUrl,
        aspect: result.aspect,
      } as Partial<ImageLayer>);
      setNotice({ tone: "ok", text: "Selected object cut out." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not apply the selected cutout.",
      });
      throw error;
    } finally {
      setFxBusy(false);
      setFxStatus(null);
      setFxProgress(null);
    }
  };

  const queueProductHandoff = (
    target: Product,
    transferLines: Record<string, number>,
    transferRoster: RosterEntry[],
    handoffNotice?: string
  ) => {
    pendingProductHandoff = {
      targetSlug: target.slug,
      colorSlug: mockup.slug,
      colorCode,
      colorName: mockup.name,
      colorHex: mockup.hex,
      design,
      lines: Object.fromEntries(target.sizes.map((size) => [size.label, transferLines[size.label] ?? 0])),
      roster: transferRoster,
      nn,
      notice: handoffNotice,
    };
  };

  const handoffToProduct = (target: Product): boolean => {
    if (target.id === product.id) return false;
    const unavailableLines = product.sizes
      .filter((size) => (lines[size.label] ?? 0) > 0 && !target.sizes.some((targetSize) => targetSize.label === size.label))
      .map((size) => ({ label: size.label, qty: lines[size.label] ?? 0 }));
    const incompatibleRoster = roster.filter((entry) => !target.sizes.some((size) => size.label === entry.size));
    if (unavailableLines.length || incompatibleRoster.length) {
      setProductSwitchPrompt({ target, unavailableLines, rosterCount: incompatibleRoster.length });
      setPanel("switch-confirm");
      return false;
    }
    queueProductHandoff(target, lines, roster);
    return true;
  };

  const confirmProductSwitch = () => {
    if (!productSwitchPrompt) return;
    const { target, unavailableLines, rosterCount } = productSwitchPrompt;
    const retainedRoster = roster.filter((entry) => target.sizes.some((size) => size.label === entry.size));
    const removedUnits = unavailableLines.reduce((sum, line) => sum + line.qty, 0);
    const summary = [
      removedUnits ? `${removedUnits} item${removedUnits === 1 ? "" : "s"} in ${unavailableLines.map((line) => line.label).join(", ")}` : "",
      rosterCount ? `${rosterCount} names/numbers assignment${rosterCount === 1 ? "" : "s"}` : "",
    ].filter(Boolean).join(" and ");
    const handoffNotice = summary ? `Unavailable sizes were removed: ${summary}. Your artwork was kept.` : undefined;
    queueProductHandoff(target, lines, retainedRoster, handoffNotice);
    setProductSwitchPrompt(null);
    setPanel("none");
    router.push(`/customize/${target.slug}`);
  };

  /* ---- stage fit ---- */
  const split = SPLIT_PANELS.includes(panel);
  /**
   * On portrait phones the inspector floats over the canvas, so the stage keeps
   * its full size and the garment is only panned to stay clear of the sheet.
   */
  const overlayPanel = compact && !shortViewport && step === "design" && panel !== "none";
  const visibleStageH = overlayPanel ? Math.max(120, stageBox.h - panelHeight) : stageBox.h;
  const focusY = useMemo(() => {
    if (!overlayPanel) return null;
    const pa = printAreaView(side, product.printArea);
    return pa.y + ((selected?.y ?? 50) / 100) * pa.h;
  }, [overlayPanel, side, product.printArea, selected?.y]);
  const fit = useMemo(
    () => fitStage(stageBox.w, stageBox.h, zoom, { visibleH: visibleStageH, focusY }),
    [stageBox, zoom, visibleStageH, focusY]
  );

  /* ---- what the rail highlights ---- */
  const railActive =
    panel === "products"
      ? "products"
      : split && selected?.type === "text"
        ? "text"
        : split
          ? "upload"
          : panel === "text-add" ? "text"
            : panel === "upload" ? "upload"
              : panel === "art" ? "art"
                : panel === "templates" ? "templates"
                  : panel.startsWith("names") || panel === "roster" ? "names"
                    : panel === "distress" ? "distress"
                      : panel === "saved" ? "saved"
                        : panel === "ideas" ? "ideas" : "";

  const callHref = contactPhone ? `tel:${contactPhone.replace(/[^\d+]/g, "")}` : "/contact";

  /* ---------------------------------------------------------------------
     Panel content
     --------------------------------------------------------------------- */
  const hasNames = personalization !== "none";

  function renderPanel() {
    if (step === "quantity") {
      return (
        <QuantityPanel
          product={product}
          lines={lines}
          quantity={quantity}
          quote={quote}
          rosterLocked={rosterLocked}
          onQty={setQty}
          onFill={fillAllInSize}
          onEditRoster={() => {
            setStep("design");
            setPanel("roster");
          }}
        />
      );
    }
    if (step === "review") {
      return (
        <ReviewPanel
          product={product}
          mockup={mockup}
          sidesLabel={
            sides.length ? sides.map((s) => (s === "front" ? "Front" : "Back")).join(" + ") : "Blank shirt"
          }
          elements={design.front.length + design.back.length}
          quantity={quantity}
          quote={quote}
          lines={sizeLines}
          roster={rosterLocked ? roster.length : 0}
          previews={previews}
          rows={
            addedCount > 0 ? (
              <Link href="/cart" className="rot-cta rot-cta-ghost">
                Go to cart ({addedCount})
              </Link>
            ) : null
          }
        />
      );
    }

    switch (panel) {
      case "products":
        return (
          <ProductsPanel
            product={product}
            products={products}
            mockup={mockup}
            mockups={productMockups}
            onColor={changeColor}
            onSwitchProduct={handoffToProduct}
            onClose={closePanel}
          />
        );
      case "switch-confirm":
        return productSwitchPrompt ? (
          <ProductSwitchConfirmPanel
            target={productSwitchPrompt.target}
            unavailableLines={productSwitchPrompt.unavailableLines}
            rosterCount={productSwitchPrompt.rosterCount}
            onContinue={confirmProductSwitch}
            onCancel={() => {
              setProductSwitchPrompt(null);
              setPanel("products");
            }}
          />
        ) : null;
      case "text":
        return selected?.type === "text" ? (
          <TextEditor
            layer={selected}
            focusToken={focusToken}
            actions={actionsFor(selected)}
            onChange={(changes) => patchActive(selected.id, changes)}
            onClose={closePanel}
          />
        ) : null;
      case "text-add":
        return <AddTextPanel onAdd={addText} onClose={closePanel} />;
      case "upload":
        return (
          <div className="rot-scroll">
            <h2 className="rot-ptitle">Upload Artwork</h2>
            <button type="button" className="rot-upload-zone" onClick={openFilePicker} disabled={busy}>
              <CloudUploadIcon size={42} />
              <strong>{busy ? "Reading artwork..." : "Choose an image"}</strong>
              <span>PNG, JPG, WebP, SVG or GIF</span>
            </button>
            <button type="button" className="rot-textlink" onClick={closePanel}>Done</button>
          </div>
        );
      case "image":
        return selected?.type === "image" ? (
          <ImageEditor
            layer={selected}
            busy={fxBusy}
            busyLabel={fxStatus ?? undefined}
            progress={fxProgress}
            eyebrow={ART_LIBRARY.some((a) => a.src === selected.origSrc) ? "Add Art" : "Upload Art"}
            actions={actionsFor(selected)}
            onFx={(next) => void applyFx(selected, next)}
            onApplySelection={applySubjectSelection}
            onChange={(changes) => patchActive(selected.id, changes)}
            onReset={() => void resetImage(selected)}
            onClose={closePanel}
          />
        ) : null;
      case "art":
        return <ArtPanel onAdd={addArt} onClose={closePanel} />;
      case "templates":
        return <TemplatesPanel onAdd={addTemplate} onClose={closePanel} />;
      case "ideas":
        return <TextIdeasPanel side={side} onAdd={addTextIdeaLayers} onClose={closePanel} />;
      case "names-intro":
        return <NamesIntro onStart={() => setPanel("names")} onClose={closePanel} />;
      case "names":
        return (
          <NamesTools
            settings={nn}
            onChange={(p) => setNn((s) => ({ ...s, ...p }))}
            onEnter={enterRoster}
            onRemove={removeNames}
            hasExisting={hasNames}
            onClose={closePanel}
          />
        );
      case "roster":
        return (
          <RosterEditor
            settings={nn}
            roster={roster}
            sizes={sizeLabels}
            onUpdate={(id, p) => commitRoster(roster.map((e) => (e.id === id ? { ...e, ...p } : e)))}
            onAdd={() =>
              commitRoster([
                ...roster,
                { id: uid(), name: "", number: "", subtitle: "", size: roster[roster.length - 1]?.size ?? defaultSize },
              ])
            }
            onRemove={(id) => commitRoster(roster.filter((e) => e.id !== id))}
            onDone={finishRoster}
            onBack={() => setPanel("names")}
          />
        );
      case "distress":
        return (
          <DistressPanel
            level={distressLevel}
            hasLayers={layers.length > 0}
            side={side}
            onPick={setDistress}
            onClose={closePanel}
          />
        );
      case "layers":
        return (
          <LayersPanel
            layers={layers}
            selectedIds={selectedIds}
            multiSelect={multiSelect}
            canUngroup={selectionIsWholeGroup(design, side, selectedIds)}
            onPick={(id) => setSelectedIds(selectionIds(design, side, id))}
            onToggle={toggleSelected}
            onMultiSelect={setMultiSelect}
            onGroup={groupSelected}
            onUngroup={() => ungroupSelected()}
            onDuplicate={duplicateSelected}
            onDelete={() => deleteLayers(selectedIds)}
            onClose={closePanel}
          />
        );
      case "saved":
        return (
          <SavedPanel
            drafts={drafts}
            onSave={saveDraft}
            onLoad={loadDraft}
            onDelete={deleteDraft}
            onClose={closePanel}
          />
        );
      default:
        return (
          <ProductsPanel product={product} products={products} mockup={mockup} mockups={productMockups} onColor={changeColor} onSwitchProduct={handoffToProduct} onClose={closePanel} />
        );
    }
  }

  const layout =
    step !== "design" ? "full" : panel === "none" ? "none" : split ? "split" : "full";

  /* Grouping state for the floating selection bar. */
  const wholeGroup = selectionIsWholeGroup(design, side, selectedIds);
  const canGroup = selectedIds.length >= 2 && !wholeGroup;
  const canUngroup = wholeGroup;
  // On phones the editor is a bottom sheet that covers the bar, so it steps
  // aside; the sheet's own action bar handles the focused element.
  const showSelectionBar = step === "design" && selectedIds.length > 0 && !overlayPanel;

  const tools: { id: string; label: string; icon: React.ReactNode; onClick: () => void }[] = [
    {
      id: "products",
      label: "Product",
      icon: <ShirtIcon size={38} />,
      onClick: () => {
        setSelectedIds([]);
        setPanel("products");
      },
    },
    {
      id: "upload",
      label: "Upload",
      icon: <CloudUploadIcon size={38} />,
      onClick: () => { setSelectedIds([]); setPanel("upload"); },
    },
    {
      id: "text",
      label: "Add Text",
      icon: <TextBoxIcon size={38} />,
      onClick: () => { setSelectedIds([]); setPanel("text-add"); },
    },
    {
      id: "art",
      label: "Add Graphics",
      icon: <ArtIcon size={38} />,
      onClick: () => {
        setSelectedIds([]);
        setPanel("art");
      },
    },
    {
      id: "templates",
      label: "Templates",
      icon: <TemplatesIcon size={38} />,
      onClick: () => {
        setSelectedIds([]);
        setPanel("templates");
      },
    },
    {
      id: "layers",
      label: "Layers",
      icon: <LayersIcon size={38} />,
      // Keeps whatever is picked, so a canvas pick can be grouped from here.
      onClick: () => setPanel("layers"),
    },
    {
      id: "names",
      label: "Names & Numbers",
      icon: <PersonalizeIcon size={40} />,
      onClick: startNames,
    },
    {
      id: "saved",
      label: "Saved Designs",
      icon: <UserIcon size={38} />,
      onClick: () => {
        setSelectedIds([]);
        setDrafts(loadDrafts());
        setPanel("saved");
      },
    },
    {
      id: "ideas",
      label: "Text Ideas",
      icon: <TextBoxIcon size={38} />,
      onClick: () => {
        setSelectedIds([]);
        setPanel("ideas");
      },
    },
    {
      id: "distress",
      label: "Distress",
      icon: <DistressIcon size={38} />,
      onClick: () => {
        setSelectedIds([]);
        setPanel("distress");
      },
    },
  ];

  return (
    <div
      className="rot"
      data-step={step}
      data-layout={layout}
      onKeyDown={(event) => {
        if (step !== "design" || transforming || !(event.ctrlKey || event.metaKey)) return;
        const target = event.target;
        if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable=true]")) return;
        if (event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) redo(); else undo();
        } else if (event.key.toLowerCase() === "y") {
          event.preventDefault(); redo();
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = step === "design" && !busy ? "copy" : "none";
        }
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        void onUpload(event.dataTransfer.files[0]);
      }}
      onPaste={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable=true]")) return;
        const file = Array.from(event.clipboardData.items).find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
        if (file) { event.preventDefault(); void onUpload(file); }
      }}
      onPointerDownCapture={(event) => {
        if (step !== "design" || panel === "none") return;
        const target = event.target;
        if (target instanceof Element && target.closest(".rot-panel, .rot-rail, .rot-quickadd, .rot-canvas, .rot-selbar")) return;
        closePanel();
      }}
      style={{ ["--step" as string]: stepIndex }}
    >
      {/* ---- App bar ---- */}
      <header className="rot-bar">
        <Link href="/" className="rot-logo" aria-label="Kingdom Custom Print — home">
          <Image
            src="/brand/kingdom-logo.png"
            alt="Kingdom Custom Print"
            width={1400}
            height={843}
            loading="eager"
          />
        </Link>
        <div className="rot-bar-actions">
          <button type="button" className="rot-barbtn rot-mobile-share" onClick={shareDesign} disabled={busy} aria-label="Share design preview" title="Share design preview"><ShareIcon size={22} /></button>
          <Link href={callHref} className="rot-barbtn">
            <HeadsetIcon size={34} />
            <span>Call or Chat</span>
          </Link>
          <button type="button" className="rot-barbtn rot-header-save" onClick={saveDraft}>
            <SaveIcon size={34} />
            <span>Save</span>
          </button>
          {cartCount > 0 ? (
            <Link href="/cart" className="rot-barbtn rot-cartbtn" aria-label={`Cart, ${cartCount} items`}>
              <CartGlyph size={34} />
              <span>Cart</span>
              <b className="rot-cartbadge">{cartCount}</b>
            </Link>
          ) : null}
          <div className="rot-bar-price" aria-live="polite">
            <small>Blank from {formatUSD(product.basePrice)}</small>
            <strong>{quantity > 0 ? `Order ${formatUSD(quote.total)} total · ${formatUSD(quote.total / quantity)} avg each` : "Price updates with quantity"}</strong>
          </div>
          <button type="button" className="rot-next rot-header-next" onClick={goNext} disabled={busy}>
            {step === "review" ? <CartGlyph size={24} /> : <ChevronRightIcon size={24} />}
            <span>{step === "review" ? (busy ? "Adding…" : addedCount ? "Add another" : "Add to Cart") : step === "quantity" ? "Review" : "Next"}</span>
          </button>
        </div>
      </header>

      {/* ---- Steps ---- */}
      <nav className="rot-steps" aria-label="Order steps">
        {STEP_ORDER.map((key, i) => {
          const active = step === key;
          const done = stepIndex > i;
          return (
            <button
              key={key}
              type="button"
              className={`rot-step${active ? " is-active" : ""}${done ? " is-done" : ""}`}
              aria-current={active ? "step" : undefined}
              onClick={() => goStep(key)}
            >
              <span className="rot-step-n">{done ? <CheckGlyph size={16} /> : i + 1}</span>
              <span className="rot-step-label">{STEP_LABEL[key]}</span>
            </button>
          );
        })}
        <span className="rot-steps-bar" aria-hidden="true" />
      </nav>

      {notice ? (
        <p
          className={`rot-toast is-${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}

      {/* ---- Body ---- */}
      <div className="rot-body">
        <div className="rot-main">
          <div className="rot-preview">
            <div className="rot-stage-top">
              <div className="rot-history" role="group" aria-label="History">
                <button type="button" onClick={undo} disabled={!hist.canUndo || transforming} aria-label="Undo" title="Undo">
                  <UndoIcon size={22} />
                </button>
                <button type="button" onClick={redo} disabled={!hist.canRedo || transforming} aria-label="Redo" title="Redo">
                  <RedoIcon size={22} />
                </button>
              </div>
              <div className="rot-stage-actions">
                <div className="rot-side-switcher" aria-label="Garment side">
                  {(["front", "back"] as const).map((view) => (
                    <button
                      key={view}
                      type="button"
                      className={`rot-side-thumb${side === view ? " is-active" : ""}`}
                      onClick={() => {
                        setSide(view);
                        setSelectedIds([]);
                        setPanel((p) => (SPLIT_PANELS.includes(p) ? "none" : p));
                      }}
                      aria-pressed={side === view}
                      aria-label={view === "front" ? "Front view" : "Back view"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={view === "front" ? mockup.front : mockup.back} alt="" />
                      <span>{view}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="rot-stage-chip" onClick={() => setZoom((z) => (z > 1 ? 1 : 1.12))}>
                  {zoom > 1 ? "Fit" : "Zoom"}
                </button>
                <button type="button" className="rot-stage-chip rot-start-over" onClick={startOver}>
                  Start over
                </button>
                <button
                  type="button"
                  className="rot-rotate rot-rotate-compact"
                  onClick={rotateSide}
                  aria-label={`Rotate to the ${side === "front" ? "back" : "front"}`}
                >
                  <span className="rot-rotate-icon">
                    <RotateShirtIcon />
                  </span>
                  <span className="rot-rotate-label">Rotate</span>
                </button>
              </div>
            </div>

          <section className="rot-stage" ref={stageRef} aria-label="Design preview">
            {fit.size > 0 ? (
              <div
                className={`rot-shirt${flipping ? " is-flipping" : ""}`}
                style={{
                  width: fit.size,
                  height: fit.size,
                  left: fit.left,
                  transform: `translateY(${fit.ty}px)`,
                }}
              >
                <DesignCanvas
                  key={`${mockup.code}-${side}`}
                  frontSrc={mockup.front}
                  backSrc={mockup.back}
                  side={side}
                  printArea={product.printArea}
                  design={design}
                  selectedIds={selectedIds}
                  compact={compact}
                  renderSize={fit.size}
                  onSelect={handleSelect}
                  onTap={handleTap}
                  onChange={patch}
                  onGestureStart={() => {
                    if (historyRef.current.at(-1) !== design) historyRef.current = [...historyRef.current.slice(-29), design];
                    setTransforming(true);
                    if (compact && SPLIT_PANELS.includes(panel)) setPanel("none");
                  }}
                  onCommit={() => setTransforming(false)}
                  onDelete={deleteLayers}
                  onEdit={editLayer}
                  onUngroup={ungroupSelected}
                />
              </div>
            ) : null}

            {layers.length === 0 && panel === "none" && step === "design" ? (
              <div className="rot-quickadd" role="group" aria-label="Add to your design">
                <button type="button" onClick={() => setPanel("text-add")}>
                  <TextBoxIcon size={26} />
                  <span>Add Text</span>
                </button>
                <button type="button" onClick={openFilePicker} disabled={busy}>
                  <CloudUploadIcon size={26} />
                  <span>{busy ? "Reading…" : "Upload Art"}</span>
                </button>
                <button type="button" onClick={() => setPanel("art")}>
                  <ArtIcon size={26} />
                  <span>Add Art</span>
                </button>
                <button type="button" onClick={startNames}>
                  <PersonalizeIcon size={26} />
                  <span>Names & Numbers</span>
                </button>
              </div>
            ) : null}

            {showSelectionBar ? (
              <div
                className="rot-selbar"
                role="toolbar"
                aria-label="Selection actions"
                data-mode={multiSelect ? "pick" : "select"}
              >
                <span className="rot-selcount" role="status" aria-live="polite">
                  {selectedIds.length} selected
                </span>

                {canGroup ? (
                  <button
                    type="button"
                    className="rot-selbtn is-primary"
                    onClick={groupSelected}
                    aria-label={`Group ${selectedIds.length} elements`}
                    title="Group"
                  >
                    <GroupIcon size={20} />
                    <span>Group</span>
                  </button>
                ) : null}

                {canUngroup ? (
                  <button
                    type="button"
                    className="rot-selbtn"
                    onClick={() => ungroupSelected()}
                    aria-label="Ungroup"
                    title="Ungroup"
                  >
                    <UngroupIcon size={20} />
                    <span>Ungroup</span>
                  </button>
                ) : null}

                {!canGroup && !canUngroup ? (
                  <button
                    type="button"
                    className={`rot-selbtn${multiSelect ? " is-on" : ""}`}
                    aria-pressed={multiSelect}
                    aria-label="Select more elements"
                    title="Select more"
                    onClick={() => setMultiSelect((m) => !m)}
                  >
                    <GroupIcon size={20} />
                    <span>Select more</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  className="rot-selbtn"
                  onClick={duplicateSelected}
                  aria-label="Duplicate selection"
                  title="Duplicate"
                >
                  <DuplicateIcon size={20} />
                  <span>Duplicate</span>
                </button>

                <button
                  type="button"
                  className={`rot-selbtn${allLocked ? " is-on" : ""}`}
                  onClick={toggleLockSelected}
                  aria-label={allLocked ? "Unlock selection" : "Lock selection"}
                  title={allLocked ? "Unlock" : "Lock"}
                >
                  <LockIcon size={20} open={!allLocked} />
                  <span>{allLocked ? "Unlock" : "Lock"}</span>
                </button>

                <button
                  type="button"
                  className="rot-selbtn is-danger"
                  onClick={() => deleteLayers(selectedIds)}
                  aria-label="Delete selection"
                  title="Delete"
                >
                  <TrashIcon size={20} />
                  <span>Delete</span>
                </button>

                <button
                  type="button"
                  className="rot-selbtn is-done"
                  onClick={clearSelection}
                  aria-label="Clear selection"
                  title="Done"
                >
                  <CloseIcon size={20} />
                  <span>Done</span>
                </button>
              </div>
            ) : null}

            <button type="button" className="rot-share" onClick={shareDesign} aria-label="Share this design">
              <ShareIcon size={34} />
              <span>SHARE</span>
            </button>
          </section>

          </div>
          <nav className="rot-rail" aria-label="Design tools">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`rot-tool${railActive === t.id ? " is-active" : ""}`}
                data-tool={t.id}
                onClick={t.onClick}
                disabled={step !== "design"}
              >
                <span className="rot-tool-icon">{t.icon}</span>
                <span className="rot-tool-label">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <aside className="rot-panel" aria-label="Design controls" ref={panelRef}>
          {split || overlayPanel ? (
            <button
              type="button"
              className="rot-panel-dismiss"
              onClick={() => setPanel("none")}
              aria-label="Hide controls to move artwork"
              title="Hide controls to move artwork"
            >
              <span aria-hidden="true" />
            </button>
          ) : null}
          {renderPanel()}
        </aside>
      </div>

      <footer className="rot-orderbar" aria-label="Design order actions">
        <div className="rot-order-summary" aria-live="polite">
          <strong>{product.name}</strong>
          <span>{quantity > 0 ? `${quantity} item${quantity === 1 ? "" : "s"} · ${formatUSD(quote.total)} total` : `Blank from ${formatUSD(product.basePrice)} · price updates with quantity`}</span>
        </div>
        <button type="button" className="rot-footer-button" onClick={showPrice}>
          <DollarIcon size={20} />
          <span>Get Price</span>
        </button>
        <button type="button" className="rot-footer-button rot-save-design" onClick={saveDraft} aria-label="Save design">
          <SaveIcon size={20} />
          <span>Save Design</span>
        </button>
        <button type="button" className="rot-footer-button is-primary" onClick={goNext} disabled={busy}>
          <span>{step === "review" ? (addedCount ? "Add Another" : "Add to Cart") : step === "quantity" ? "Review" : "Next Step"}</span>
          {step === "review" ? <CartGlyph size={20} /> : <ChevronRightIcon size={20} />}
        </button>
      </footer>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        onChange={(e) => onUpload(e.target.files?.[0])}
        className="rot-hidden-file"
        aria-label="Upload artwork file"
        tabIndex={-1}
      />
    </div>
  );
}
