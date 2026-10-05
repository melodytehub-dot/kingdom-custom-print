"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ProductPhotography from "../ProductPhotography";
import DesignCanvas, { VIEW, printAreaView } from "./DesignCanvas";
import {
  ArtPanel,
  AiDesignPanel,
  DistressPanel,
  NamesIntro,
  NamesTools,
  NN_DEFAULTS,
  ProductsPanel,
  QuantityPanel,
  ReviewPanel,
  RosterEditor,
  SavedPanel,
  type NNSettings,
  type NNSize,
} from "./panels";
import { ImageEditor, TextEditor, type LayerActionsProps } from "./editors";
import {
  AiArtIcon,
  ArtIcon,
  CartGlyph,
  CheckGlyph,
  CloudUploadIcon,
  DistressIcon,
  DollarIcon,
  HeadsetIcon,
  PersonalizeIcon,
  RedoIcon,
  RotateShirtIcon,
  SaveIcon,
  ShareIcon,
  ShirtIcon,
  TextBoxIcon,
  UndoIcon,
  UserIcon,
} from "./icons";
import { type ArtItem, ART_LIBRARY } from "./art";
import {
  duplicateLayer,
  emptyDesign,
  loadDrafts,
  newImageLayer,
  newTextLayer,
  normalizeDesign,
  persistDrafts,
  personalizationOf,
  readImageFile,
  removeLayer,
  reorderLayer,
  updateLayer,
  usedSides,
  validateUpload,
  type SavedDraft,
} from "@/lib/design";
import { applyImageFx, DEFAULT_FX } from "@/lib/imageFx";
import { drawPreview } from "./preview";
import { mockupForColor, mockupsForProduct, TEE_MOCKUPS, type TeeMockup } from "@/lib/mockups";
import { useCart } from "@/lib/cart-context";
import { quoteProduct } from "@/lib/pricing";
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
  | "text"
  | "image"
  | "art"
  | "ai"
  | "names-intro"
  | "names"
  | "roster"
  | "distress"
  | "saved";

const STEP_ORDER: Step[] = ["design", "quantity", "review"];
const STEP_LABEL: Record<Step, string> = {
  design: "Design",
  quantity: "Quantity & sizes",
  review: "Review",
};

/** Panels that sit under the shirt; everything else takes over the screen on mobile. */
const SPLIT_PANELS: Panel[] = ["text", "image"];

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

const uid = () => `r-${Math.random().toString(36).slice(2, 9)}`;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

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
      const { origSrc, fx, ...rest } = l as ImageLayer;
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

  const productMockups = useMemo(() => mockupsForProduct(product), [product]);

  const [step, setStep] = useState<Step>("design");
  const [panel, setPanel] = useState<Panel>("none");
  const [side, setActiveSide] = useState<GarmentSide>("front");
  const [profileView, setProfileView] = useState(false);
  const setSide = useCallback((view: GarmentSide | ((previous: GarmentSide) => GarmentSide)) => { setActiveSide(view); setProfileView(false); }, []);
  const [colorCode, setColorCode] = useState(() => {
    const match =
      productMockups.find((m) => m.slug === initialColor || m.code === initialColor) ?? productMockups[0] ?? TEE_MOCKUPS[0];
    return match.code;
  });
  const [design, setDesign] = useState<Design>(emptyDesign);
  const [lines, setLines] = useState<Record<string, number>>(initialLines);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fxBusy, setFxBusy] = useState(false);
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
  const openFilePicker = useCallback(() => {
    fileInput.current?.click();
  }, []);
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  const [compact, setCompact] = useState(true);

  const draftKey = `kcp.draft.v3.${product.slug}`;
  const [ready, setReady] = useState(false);
  const historyRef = useRef<Design[]>([]);
  const futureRef = useRef<Design[]>([]);
  const applyingHistory = useRef(false);
  const restored = useRef(false);

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
  const selected = selectedId ? layers.find((l) => l.id === selectedId) : undefined;
  const cartCount = items.reduce((n, i) => n + i.quantity, 0);
  const rosterLocked = roster.length > 0 && personalization !== "none";

  /* ---- restore draft on mount ---- */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDrafts(loadDrafts());
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DraftState>;
        if (parsed?.design?.front && parsed?.design?.back) {
          setDesign(normalizeDesign(parsed.design));
        }
        if (!initialColor && parsed?.colorCode && productMockups.some((m) => m.code === parsed.colorCode)) {
          setColorCode(parsed.colorCode);
        }
        if (Array.isArray(parsed?.roster)) setRoster(parsed.roster);
        if (parsed?.nn) setNn({ ...NN_DEFAULTS, ...parsed.nn });
        const fromUrl = Object.values(initialLines).some((n) => n > 0);
        if (!fromUrl && parsed?.lines) {
          setLines((prev) => ({ ...prev, ...parsed.lines }));
        }
      }
    } catch {
      // A corrupt draft should not block the editor; start clean.
    }
    restored.current = true;
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, productMockups]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* ---- autosave draft ---- */
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ colorCode, design, lines, roster, nn } satisfies DraftState)
      );
    } catch {
      // Storage unavailable or full; the in-progress design still works.
    }
  }, [ready, draftKey, colorCode, design, lines, roster, nn]);

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

  /* ---- measure the stage so the shirt can be fitted and panned ---- */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const mq = window.matchMedia("(max-width: 900px)");
    const read = () => {
      setCompact(mq.matches);
      setStageBox({ w: el.clientWidth, h: el.clientHeight });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    mq.addEventListener("change", read);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", read);
    };
  }, [step]);

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
  const handleSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id) {
        const layer = design[side].find((l) => l.id === id);
        if (layer) {
          // Selecting artwork is the mobile equivalent of opening Edit. A
          // locked layer from an older saved draft must not trap the customer
          // in a disabled editor with no obvious way to continue.
          if (layer.locked) {
            setDesign((prev) => updateLayer(prev, side, id, { locked: false }));
          }
          setPanel(layer.type === "text" ? "text" : "image");
        }
      } else {
        setPanel((p) => (SPLIT_PANELS.includes(p) ? "none" : p));
      }
    },
    [design, side]
  );

  const closePanel = () => {
    setSelectedId(null);
    setPanel("none");
  };

  const editLayer = (id: string) => {
    const layer = design[side].find((l) => l.id === id);
    if (!layer) return;
    // Opening the editor is an explicit request to edit. Older saved drafts
    // can contain a locked layer, so unlock it at this boundary instead of
    // opening a panel whose controls are all disabled.
    if (layer.locked) {
      setDesign((prev) => updateLayer(prev, side, id, { locked: false }));
    }
    setSelectedId(id);
    setPanel(layer.type === "text" ? "text" : "image");
    setFocusToken((n) => n + 1);
  };

  const rotateSide = () => {
    setFlipping(true);
    window.setTimeout(() => setFlipping(false), 320);
    setSide((s) => (s === "front" ? "back" : "front"));
    setSelectedId(null);
    setPanel((p) => (SPLIT_PANELS.includes(p) ? "none" : p));
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

  /* ---- adding things ---- */
  const addText = () => {
    const layer = newTextLayer(darkShirt ? { color: "#FFFFFF" } : {});
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], layer] }));
    setSelectedId(layer.id);
    setPanel("text");
  };

  const addImageLayer = (src: string, name: string, aspect: number) => {
    const layer = newImageLayer(src, name, aspect, { origSrc: src, fx: { ...DEFAULT_FX } });
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], layer] }));
    setSelectedId(layer.id);
    setPanel("image");
  };

  const addArt = (item: ArtItem) => {
    addImageLayer(item.src, item.name, 1);
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
    setFxBusy(true);
    try {
      const res = await applyImageFx(orig, fx);
      patch(side, layer.id, {
        fx,
        origSrc: orig,
        src: res.dataUrl,
        aspect: res.aspect,
      } as Partial<ImageLayer>);
    } catch (err) {
      setNotice({
        tone: "error",
        text: err instanceof Error ? err.message : "That edit could not be applied.",
      });
    } finally {
      setFxBusy(false);
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

  /* ---- layer actions (shared by both editors) ---- */
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
      onLock: () => patchActive(layer.id, { locked: !layer.locked }),
      onDuplicate: () => {
        const res = duplicateLayer(design, side, layer.id);
        if (res) {
          setDesign(res.design);
          setSelectedId(res.id);
        }
      },
    };
  };

  const deleteLayer = (id: string) => {
    setDesign((prev) => removeLayer(prev, side, id));
    if (selectedId === id) {
      setSelectedId(null);
      setPanel((p) => (SPLIT_PANELS.includes(p) ? "none" : p));
    }
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
    setSelectedId(null);
    setPanel(personalization === "none" ? "names-intro" : "names");
  };

  const generateAiDesign = (created: DesignLayer[], summary: string) => {
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], ...created] }));
    setSelectedId(null);
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
    setSelectedId(null);
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
    setSelectedId(null);
    setPanel("none");
    setZoom(1);
    setNotice({ tone: "ok", text: "Started a fresh design." });
  };

  /* ---- history ---- */
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
    setSelectedId(null);
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
    applyingHistory.current = true;
    setDesign(normalizeDesign(found.design));
    setSelectedId(null);
    const m =
      productMockups.find((candidate) => candidate.slug === found.colorSlug) ??
      mockupForColor(found.colorName, found.colorHex);
    if (m) setColorCode(m.code);
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
      applyingHistory.current = true;
      setDesign(emptyDesign());
      setRoster([]);
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

  /* ---- steps ---- */
  const stepIndex = STEP_ORDER.indexOf(step);

  const goStep = (next: Step) => {
    setStep(next);
    setSelectedId(null);
    setPanel("none");
  };

  const goNext = () => {
    if (step === "review") {
      void handleAddToCart();
      return;
    }
    goStep(STEP_ORDER[stepIndex + 1]);
  };

  /* ---- stage fit: shirt fills the width on phones, fits whole on desktop ---- */
  const split = SPLIT_PANELS.includes(panel);
  const fit = useMemo(() => {
    const { w, h } = stageBox;
    if (!w || !h) return { size: 0, left: 0, ty: 0 };
    // RushOrderTees keeps the garment large in the square workspace. The
    // previous fit left too much empty space above and below the shirt.
    const size = (compact ? w * 1.14 : Math.min(w * 1.1, h * 1.1)) * zoom;
    const top = 0.054 * size;
    const silhouetteH = 0.892 * size;
    let ty = (h - silhouetteH) / 2 - top;
    if (silhouetteH > h * 0.96) ty = -top + h * 0.02;
    const selY = selected?.y ?? null;
    if (split && selectedId && compact && selY !== null) {
      const pa = printAreaView(side, product.printArea);
      const focusY = ((pa.y + (selY / 100) * pa.h) / VIEW) * size;
      const wanted = h * 0.6 - focusY;
      const maxTy = -top + h * 0.06;
      const minTy = h - 0.946 * size - h * 0.04;
      ty = minTy < maxTy ? clamp(wanted, minTy, maxTy) : ty;
    }
    return { size, left: (w - size) / 2, ty };
  }, [stageBox, compact, split, selectedId, selected?.y, side, zoom, product.printArea]);

  /* ---- what the rail highlights ---- */
  const railActive =
    panel === "products"
      ? "products"
      : split && selected?.type === "text"
        ? "text"
        : split
          ? "upload"
          : panel === "art"
            ? "art"
            : panel.startsWith("names") || panel === "roster"
              ? "names"
              : panel === "distress"
                ? "distress"
                : panel === "saved"
                  ? "saved"
                  : "";

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
            onClose={closePanel}
          />
        );
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
      case "image":
        return selected?.type === "image" ? (
          <ImageEditor
            layer={selected}
            busy={fxBusy}
            eyebrow={ART_LIBRARY.some((a) => a.src === selected.origSrc) ? "Add Art" : "Upload Art"}
            actions={actionsFor(selected)}
            onFx={(next) => void applyFx(selected, next)}
            onChange={(changes) => patchActive(selected.id, changes)}
            onReset={() => void resetImage(selected)}
            onClose={closePanel}
          />
        ) : null;
      case "art":
        return <ArtPanel onAdd={addArt} onClose={closePanel} />;
      case "ai":
        return <AiDesignPanel side={side} onGenerate={generateAiDesign} onClose={closePanel} />;
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
          <div className="rot-scroll rot-empty">
            <p className="rot-eyebrow">Design Studio</p>
            <h2 className="rot-ptitle">Start designing</h2>
            <p className="rot-phint">
              Add text, upload your artwork or pick clipart. Tap anything on the shirt to edit it.
            </p>
          </div>
        );
    }
  }

  const layout =
    step !== "design" ? "full" : panel === "none" ? "none" : split ? "split" : "full";

  const tools: { id: string; label: string; icon: React.ReactNode; onClick: () => void }[] = [
    {
      id: "products",
      label: "Products",
      icon: <ShirtIcon size={38} />,
      onClick: () => {
        setSelectedId(null);
        setPanel("products");
      },
    },
    {
      id: "text",
      label: "Add Text",
      icon: <TextBoxIcon size={38} />,
      onClick: addText,
    },
    {
      id: "upload",
      label: "Upload Art",
      icon: <CloudUploadIcon size={38} />,
      onClick: openFilePicker,
    },
    {
      id: "art",
      label: "Add Art",
      icon: <ArtIcon size={38} />,
      onClick: () => {
        setSelectedId(null);
        setPanel("art");
      },
    },
    {
      id: "ai",
      label: "AI Design",
      icon: <AiArtIcon size={42} />,
      onClick: () => {
        setSelectedId(null);
        setPanel("ai");
      },
    },
    {
      id: "names",
      label: "Personalize",
      icon: <PersonalizeIcon size={40} />,
      onClick: startNames,
    },
    {
      id: "saved",
      label: "Saved",
      icon: <UserIcon size={38} />,
      onClick: () => {
        setSelectedId(null);
        setDrafts(loadDrafts());
        setPanel("saved");
      },
    },
    {
      id: "distress",
      label: "Distress",
      icon: <DistressIcon size={38} />,
      onClick: () => {
        setSelectedId(null);
        setPanel("distress");
      },
    },
  ];

  return (
    <div
      className="rot"
      data-step={step}
      data-layout={layout}
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
          <Link href={callHref} className="rot-barbtn">
            <HeadsetIcon size={34} />
            <span>Call or Chat</span>
          </Link>
          <button type="button" className="rot-barbtn" onClick={saveDraft}>
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
          <button type="button" className="rot-next" onClick={goNext} disabled={busy}>
            {step === "review" ? <CartGlyph size={34} /> : <DollarIcon size={34} />}
            <span>{step === "review" ? (busy ? "Adding…" : addedCount ? "Add more" : "Add to Cart") : "Next"}</span>
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
          <section className="rot-stage" ref={stageRef} aria-label="Design preview">
            <div className="rot-stage-top">
              <div className="rot-history" role="group" aria-label="History">
                <button type="button" onClick={undo} disabled={!hist.canUndo} aria-label="Undo">
                  <UndoIcon size={22} />
                </button>
                <button type="button" onClick={redo} disabled={!hist.canRedo} aria-label="Redo">
                  <RedoIcon size={22} />
                </button>
              </div>
              <div className="rot-stage-actions">
                <div className="rot-side-switcher" aria-label="Garment side">
                  {(["front", "back"] as const).map((view) => (
                    <button
                      key={view}
                      type="button"
                      className={`rot-side-thumb${!profileView && side === view ? " is-active" : ""}`}
                      onClick={() => {
                        setSide(view);
                        setSelectedId(null);
                        setPanel((p) => (SPLIT_PANELS.includes(p) ? "none" : p));
                      }}
                      aria-pressed={!profileView && side === view}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={view === "front" ? mockup.front : mockup.back} alt="" />
                      <span>{view}</span>
                    </button>
                  ))}
                  <button type="button" className={`rot-side-thumb${profileView ? " is-active" : ""}`}
                    aria-pressed={profileView} aria-label="Side profile"
                    onClick={() => { setProfileView(true); setSelectedId(null); setPanel("none"); }}>
                    <span className="rot-profile-thumb"><ProductPhotography product={product} color={product.colors.find(c => c.slug === mockup.slug)} view="side" isolated decorative /></span>
                    <span>side</span>
                  </button>
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
                {profileView ? <div className="rot-profile-preview"><ProductPhotography product={product} color={product.colors.find(c => c.slug === mockup.slug)} view="side" isolated /><p>Side profile</p></div> : <DesignCanvas
                  key={`${mockup.code}-${side}`}
                  frontSrc={mockup.front}
                  backSrc={mockup.back}
                  side={side}
                  printArea={product.printArea}
                  design={design}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  onChange={patch}
                  onCommit={() => undefined}
                  onDelete={deleteLayer}
                  onEdit={editLayer}
                />}
              </div>
            ) : null}

            {!profileView && layers.length === 0 && panel === "none" && step === "design" ? (
              <div className="rot-quickadd" role="group" aria-label="Add to your design">
                <button type="button" onClick={addText}>
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

            <button type="button" className="rot-share" onClick={shareDesign} aria-label="Share this design">
              <ShareIcon size={34} />
              <span>SHARE</span>
            </button>
          </section>

          <nav className="rot-rail" aria-label="Design tools">
            {/* The tool callbacks intentionally close over the hidden file input ref. */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`rot-tool${railActive === t.id ? " is-active" : ""}`}
                onClick={() => { setProfileView(false); t.onClick(); }}
                disabled={step !== "design"}
              >
                <span className="rot-tool-icon">{t.icon}</span>
                <span className="rot-tool-label">{t.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <aside className="rot-panel" aria-label="Design controls">
          {renderPanel()}
        </aside>
      </div>

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
