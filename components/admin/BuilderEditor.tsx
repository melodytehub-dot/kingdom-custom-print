"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import Image from "next/image";
import BuilderPageView, { type BuilderEditorCallbacks, type DropLocation } from "@/components/builder/BuilderPageView";
import { MediaPickerModal } from "./MediaLibrary";
import type { SiteSettings } from "@/lib/catalog-types";
import type { Product } from "@/lib/types";
import { pageSlugFromTitle } from "@/lib/custom-pages";
import {
  BREAKPOINTS,
  BREAKPOINT_LABELS,
  BUILDER_LIMITS,
  WIDGET_LABELS,
  isBuilderSlug,
  isEditableStoreSlug,
  newColumn,
  newId,
  newSection,
  newWidget,
  type BoxShadow,
  type Breakpoint,
  type BuilderLayout,
  type BuilderNode,
  type BuilderPage,
  type ElementStyle,
  type FontFamilyChoice,
  type ProductGridKindFilter,
  type SectionNode,
  type TextTransformChoice,
  type WidgetKind,
} from "@/lib/builder/schema";
import { effectiveStyle, isOverridden } from "@/lib/builder/styles";
import {
  duplicateNode,
  findNode,
  insertColumn,
  insertSection,
  insertWidget,
  moveNodeWithin,
  moveSection,
  moveWidget,
  removeNode,
  resizeColumns,
  setSectionColumnsPreset,
  updateNode,
} from "@/lib/builder/tree";
import { SECTION_TEMPLATES, STARTER_PAGE_TEMPLATES, type SectionTemplate } from "@/lib/builder/templates";

type Summary = {
  slug: string;
  title: string;
  description: string;
  revision: number;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

type StorePageSummary = {
  slug: string;
  title: string;
  description: string;
  path: string;
  customized: boolean;
  published: boolean;
  updatedAt: string | null;
};

type OpenPage = {
  page: BuilderPage;
  revision: number;
  published: boolean;
  isBuiltinDefault?: boolean;
};

type LeftTab = "blocks" | "templates" | "structure" | "page";
type RightPanel = "content" | "style";

type DragPayload =
  | { kind: "new-widget"; widgetKind: WidgetKind }
  | { kind: "new-section"; templateId: string }
  | { kind: "widget"; nodeId: string }
  | { kind: "section"; nodeId: string };

/* SVG icon paths for widget palette (Elementor-style icon grid) */
const WIDGET_ICONS: Record<WidgetKind, string> = {
  heading:        "M5 4v3h5.5v12h3V7H19V4H5z",
  text:           "M3 5h18v2H3V5zm0 4h14v2H3V9zm0 4h18v2H3v-2zm0 4h10v2H3v-2z",
  image:          "M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z",
  button:         "M19 7H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2zm-4 6H9v-2h6v2z",
  faq:            "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z",
  spacer:         "M8 18h8v-2H8v2zM8 6v2h8V6H8zm-2 8h12v-4H6v4z",
  divider:        "M2 11h20v2H2v-2z",
  "promo-banner": "M2 4h20v12H2V4zm0 14h20v2H2v-2zm3-8h8v2H5v-2zm0-3h14v2H5V7z",
  "product-grid": "M4 5h4v4H4V5zm6 0h4v4h-4V5zm6 0h4v4h-4V5zM4 11h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 17h4v2H4v-2zm6 0h4v2h-4v-2zm6 0h4v2h-4v-2z",
  "category-strip":"M4 6h4v4H4V6zm6 0h4v4h-4V6zm6 0h4v4h-4V6zM4 14h16v2H4v-2z",
  "feature-cards": "M3 5h7v7H3V5zm11 0h7v7h-7V5zM3 15h7v4H3v-4zm11 0h7v4h-7v-4z",
  "image-gallery": "M22 16V4a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2zm-11-4l2.03 2.71L16 11l4 5H8l3-4zM2 6v14a2 2 0 002 2h14v-2H4V6H2z",
  "contact-block": "M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
};

const BASIC_PALETTE: { kind: WidgetKind; hint: string }[] = [
  { kind: "heading", hint: "Section title" },
  { kind: "text", hint: "Paragraph copy" },
  { kind: "image", hint: "Photo or graphic" },
  { kind: "button", hint: "Link button" },
  { kind: "faq", hint: "Accordion list" },
  { kind: "spacer", hint: "Vertical gap" },
  { kind: "divider", hint: "Thin line" },
];

const STORE_PALETTE: { kind: WidgetKind; hint: string }[] = [
  { kind: "promo-banner", hint: "Hero or banner" },
  { kind: "product-grid", hint: "Catalog cards" },
  { kind: "category-strip", hint: "Category links" },
  { kind: "feature-cards", hint: "Steps or pillars" },
  { kind: "image-gallery", hint: "Photo grid" },
  { kind: "contact-block", hint: "Inquiry form" },
];

const MAX_HISTORY = 60;

function cloneLayoutWithFreshIds(layout: BuilderLayout): BuilderLayout {
  return {
    version: 1,
    sections: layout.sections.map((section) => ({
      ...section,
      id: newId(),
      columns: section.columns.map((column) => ({
        ...column,
        id: newId(),
        widgets: column.widgets.map((widget) => ({ ...widget, id: newId() })),
      })),
    })),
  };
}

function nodeLabel(node: BuilderNode): string {
  if (node.kind === "section") return `Section · ${node.columns.length} column${node.columns.length === 1 ? "" : "s"}`;
  if (node.kind === "column") return `Column · ${node.style.desktop.columnWidth ?? 100}%`;
  return WIDGET_LABELS[node.kind];
}

function nodeHint(node: BuilderNode): string {
  if (node.kind === "heading" || node.kind === "text" || node.kind === "button") return node.text.slice(0, 36);
  if (node.kind === "promo-banner" || node.kind === "product-grid" || node.kind === "category-strip" || node.kind === "feature-cards" || node.kind === "image-gallery" || node.kind === "contact-block") {
    return node.heading.slice(0, 36);
  }
  if (node.kind === "image") return node.alt || node.src;
  if (node.kind === "faq") return `${node.items.length} question${node.items.length === 1 ? "" : "s"}`;
  return "";
}

/* ------------------------------------------------------------------ fields */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="builder-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  overridden,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number | undefined) => void;
  overridden?: boolean;
}) {
  return (
    <Field label={`${label}${suffix ? ` (${suffix})` : ""}${overridden ? " · this screen" : ""}`}>
      <input
        className="input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        placeholder="—"
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(undefined);
            return;
          }
          const numeric = Number(raw);
          if (!Number.isFinite(numeric)) return;
          const rounded = step < 1 ? Math.round(numeric * 100) / 100 : Math.round(numeric);
          onChange(Math.max(min, Math.min(max, rounded)));
        }}
      />
    </Field>
  );
}

function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <Field label={label}>
      <span className="builder-colour">
        <input
          type="color"
          value={value ?? "#ffffff"}
          aria-label={`${label} colour`}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          className="input"
          value={value ?? ""}
          placeholder="Default"
          onChange={(event) => {
            const raw = event.target.value.trim();
            onChange(/^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : raw === "" ? undefined : value);
          }}
        />
        <button type="button" className="link" onClick={() => onChange(undefined)}>Clear</button>
      </span>
    </Field>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="input"
        value={value ?? ""}
        onChange={(event) => onChange((event.target.value || undefined) as T | undefined)}
      >
        <option value="">Default</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Field>
  );
}

/* ------------------------------------------------------------------ editor */

export default function BuilderEditor({
  onDirtyChange,
  onStudioModeChange,
  onOpenHomepageEditor,
  products = [],
  categories = [],
  settings,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  onStudioModeChange?: (open: boolean) => void;
  onOpenHomepageEditor?: () => void;
  products?: Product[];
  categories?: { id: number; name: string; slug: string }[];
  settings?: SiteSettings;
}) {
  const [pages, setPages] = useState<Summary[]>([]);
  const [storePages, setStorePages] = useState<StorePageSummary[]>([]);
  const [current, setCurrent] = useState<OpenPage | null>(null);
  const [past, setPast] = useState<BuilderPage[]>([]);
  const [future, setFuture] = useState<BuilderPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [leftTab, setLeftTab] = useState<LeftTab>("blocks");
  const [panel, setPanel] = useState<RightPanel>("content");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Hub filtering + New page modal
  const [hubSearch, setHubSearch] = useState("");
  const [hubFilter, setHubFilter] = useState<"all" | "published" | "draft">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSlugEdited, setNewSlugEdited] = useState(false);
  const [starterId, setStarterId] = useState<string>(STARTER_PAGE_TEMPLATES[0].id);

  // Media picker modal callback
  const [mediaTarget, setMediaTarget] = useState<((picked: { url: string; alt: string }) => void) | null>(null);

  // Drag-and-drop state
  const [dragState, setDragState] = useState<DragPayload | null>(null);
  const [dropLocation, setDropLocation] = useState<DropLocation | null>(null);
  const dragRef = useRef<DragPayload | null>(null);
  const resizeBaselineRef = useRef<BuilderPage | null>(null);

  // Canvas scaling
  const fileInput = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scalerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [frameHeight, setFrameHeight] = useState(0);
  const [available, setAvailable] = useState(0);

  const targetWidth = breakpoint === "desktop" ? 1280 : breakpoint === "tablet" ? 820 : 390;

  useEffect(() => {
    const canvas = canvasRef.current;
    const scaler = scalerRef.current;
    if (!canvas || !scaler) return;
    const measure = () => {
      const width = canvas.clientWidth;
      const next = Math.min(1, width / targetWidth);
      setAvailable(width);
      setZoom(next);
      setFrameHeight(Math.round(scaler.scrollHeight * next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    observer.observe(scaler);
    return () => observer.disconnect();
  }, [targetWidth, breakpoint, current]);

  const selected = current && selectedId ? findNode(current.page.layout, selectedId) : null;

  const loadPages = useCallback(async () => {
    const response = await fetch("/api/admin/builder", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = (await response.json()) as { pages?: Summary[]; storePages?: StorePageSummary[] };
    return { pages: data.pages ?? [], storePages: data.storePages ?? [] };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await loadPages();
        if (!cancelled) {
          setPages(list.pages);
          setStorePages(list.storePages);
        }
      } catch {
        if (!cancelled) setError("Could not load your pages. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPages]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    onStudioModeChange?.(Boolean(current));
    return () => onStudioModeChange?.(false);
  }, [current, onStudioModeChange]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const openPage = useCallback(async (slug: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/builder?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        page: BuilderPage;
        revision: number;
        published: boolean;
        isBuiltinDefault?: boolean;
      };
      setCurrent({
        page: data.page,
        revision: data.revision,
        published: data.published,
        isBuiltinDefault: data.isBuiltinDefault,
      });
      setPast([]);
      setFuture([]);
      setSelectedId(data.page.layout.sections[0]?.id ?? null);
      setDirty(false);
      setConfirmDelete(false);
      setPanel("content");
      setLeftTab("blocks");
    } catch {
      setError("Could not open that page. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const openCreateModal = () => {
    setNewTitle("");
    setNewSlug("");
    setNewSlugEdited(false);
    setStarterId(STARTER_PAGE_TEMPLATES[0].id);
    setError("");
    setCreateOpen(true);
  };

  const createFromModal = (event: React.FormEvent) => {
    event.preventDefault();
    const template = STARTER_PAGE_TEMPLATES.find((t) => t.id === starterId) ?? STARTER_PAGE_TEMPLATES[0];
    const cleanTitle = newTitle.trim() || template.defaultTitle || "New page";
    const cleanSlug = (newSlug.trim() || pageSlugFromTitle(cleanTitle)).toLowerCase();
    if (!isBuilderSlug(cleanSlug) || isEditableStoreSlug(cleanSlug)) {
      setError("Choose a unique page address using lowercase letters, numbers, and dashes.");
      return;
    }
    const layout = template.build();
    setCreateOpen(false);
    setCurrent({
      page: {
        slug: cleanSlug,
        title: cleanTitle,
        description: "",
        showTitle: template.showTitle,
        layout,
        updatedAt: new Date().toISOString(),
      },
      revision: 0,
      published: false,
    });
    setPast([]);
    setFuture([]);
    setSelectedId(layout.sections[0]?.id ?? null);
    setDirty(true);
    setMessage("");
    setError("");
    setLeftTab("blocks");
  };

  const duplicateCustomPage = async (slug: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/builder?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { page: BuilderPage };
      const copySlug = `${slug}-copy-${Date.now().toString(36).slice(-4)}`.slice(0, BUILDER_LIMITS.slug);
      const clonedLayout = cloneLayoutWithFreshIds(data.page.layout);
      setCurrent({
        page: {
          ...data.page,
          slug: copySlug,
          title: `${data.page.title} (Copy)`.slice(0, BUILDER_LIMITS.title),
          layout: clonedLayout,
          updatedAt: new Date().toISOString(),
        },
        revision: 0,
        published: false,
      });
      setPast([]);
      setFuture([]);
      setSelectedId(clonedLayout.sections[0]?.id ?? null);
      setDirty(true);
      setMessage("Opened a duplicate draft. Save or publish when ready.");
    } catch {
      setError("Could not duplicate that page.");
    } finally {
      setBusy(false);
    }
  };

  const closePage = () => {
    if (dirty && !window.confirm("Discard unsaved changes to this page?")) return;
    setCurrent(null);
    setDirty(false);
    setSelectedId(null);
    setError("");
    setMessage("");
  };

  const commit = useCallback(
    (layout: BuilderLayout, patch: Partial<BuilderPage> = {}) => {
      setCurrent((prev) => {
        if (!prev) return prev;
        setPast((stack) => [...stack.slice(-MAX_HISTORY + 1), prev.page]);
        setFuture([]);
        return {
          ...prev,
          page: { ...prev.page, ...patch, layout, updatedAt: new Date().toISOString() },
        };
      });
      setDirty(true);
      setMessage("");
    },
    []
  );

  const undo = useCallback(() => {
    if (!current || !past.length) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([current.page, ...future].slice(0, MAX_HISTORY));
    setCurrent({ ...current, page: previous });
    setDirty(true);
  }, [current, past, future]);

  const redo = useCallback(() => {
    if (!current || !future.length) return;
    const next = future[0];
    setPast([...past.slice(-MAX_HISTORY + 1), current.page]);
    setFuture(future.slice(1));
    setCurrent({ ...current, page: next });
    setDirty(true);
  }, [current, past, future]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if (typing || !current) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, undo, redo]);

  const setStyle = (id: string, key: keyof ElementStyle, value: number | string | undefined) => {
    if (!current) return;
    const node = findNode(current.page.layout, id);
    if (!node) return;
    const style = { ...node.style };
    const scope = breakpoint;
    const scoped = { ...(style[scope] ?? {}) } as Record<string, unknown>;
    if (value === undefined || value === "") delete scoped[key];
    else scoped[key] = value;
    if (scope === "desktop") style.desktop = scoped as ElementStyle;
    else if (Object.keys(scoped).length) style[scope] = scoped as ElementStyle;
    else delete style[scope];
    commit(updateNode(current.page.layout, id, (entry) => ({ ...entry, style })));
  };

  const setNodePatch = useCallback(
    (id: string, patch: Record<string, unknown>) => {
      if (!current) return;
      commit(updateNode(current.page.layout, id, (node) => ({ ...node, ...patch }) as BuilderNode));
    },
    [current, commit]
  );

  const mutate = useCallback(
    (work: (layout: BuilderLayout) => BuilderLayout, nextSelection?: string | null) => {
      if (!current) return;
      commit(work(current.page.layout));
      if (nextSelection !== undefined) setSelectedId(nextSelection);
    },
    [current, commit]
  );

  const addWidgetToCanvas = (kind: WidgetKind, columnId?: string, index?: number) => {
    if (!current) return;
    const target =
      columnId ??
      (selected?.kind === "column"
        ? selected.id
        : selected?.kind === "section"
          ? selected.columns[0]?.id
          : undefined) ??
      current.page.layout.sections.at(-1)?.columns.at(-1)?.id;

    if (!target) {
      const section = newSection();
      const widget = newWidget(kind);
      section.columns[0].widgets.push(widget);
      commit(insertSection(current.page.layout, section));
      setSelectedId(widget.id);
      return;
    }

    const widget = newWidget(kind);
    commit(insertWidget(current.page.layout, target, widget, index));
    setSelectedId(widget.id);
    setPanel("content");
  };

  const insertTemplateSection = (template: SectionTemplate, index?: number) => {
    if (!current) return;
    const section = template.build();
    commit(insertSection(current.page.layout, section, index ?? current.page.layout.sections.length));
    setSelectedId(section.id);
  };

  const addSection = (afterIndex?: number) => {
    if (!current) return;
    const section = newSection();
    const targetIdx = afterIndex === undefined ? current.page.layout.sections.length : afterIndex + 1;
    commit(insertSection(current.page.layout, section, targetIdx));
    setSelectedId(section.id);
  };

  const addColumnTo = (section: SectionNode) => {
    if (!current) return;
    const column = newColumn();
    commit(insertColumn(current.page.layout, section.id, column));
    setSelectedId(column.id);
  };

  const removeNodeById = (id: string) => {
    if (!current) return;
    const target = findNode(current.page.layout, id);
    if (!target) return;
    const parent =
      target.kind === "column"
        ? current.page.layout.sections.find((section) => section.columns.some((column) => column.id === id))
        : null;
    if (target.kind === "section" && current.page.layout.sections.length <= 1) {
      setMessage("Every page needs at least one section.");
      return;
    }
    if (target.kind === "column" && parent && parent.columns.length <= 1) {
      setMessage("A section needs at least one column. Delete the section instead.");
      return;
    }
    commit(removeNode(current.page.layout, id));
    if (selectedId === id) setSelectedId(null);
  };

  const uploadImageForSelected = async (file: File) => {
    if (!selected || selected.kind !== "image") return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("image", file);
      const response = await fetch("/api/admin/product-media", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error);
      setNodePatch(selected.id, { src: data.url });
    } catch {
      setError("The photo could not be uploaded. Try a JPG, PNG or WebP file.");
    } finally {
      setUploading(false);
    }
  };

  const openMediaPicker = (onPick: (picked: { url: string; alt: string }) => void) => {
    setMediaTarget(() => onPick);
  };

  const startDrag = (payload: DragPayload, event: DragEvent) => {
    dragRef.current = payload;
    setDragState(payload);
    event.dataTransfer.effectAllowed = payload.kind === "widget" || payload.kind === "section" ? "move" : "copy";
    event.dataTransfer.setData("text/plain", payload.kind);
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragState(null);
    setDropLocation(null);
  };

  const handleDropAt = (location: DropLocation) => {
    const payload = dragRef.current;
    endDrag();
    if (!current || !payload) return;

    if (location.kind === "widget") {
      if (payload.kind === "new-widget") {
        addWidgetToCanvas(payload.widgetKind, location.columnId, location.index);
      } else if (payload.kind === "widget") {
        mutate((layout) => moveWidget(layout, payload.nodeId, location.columnId, location.index), payload.nodeId);
      }
      return;
    }

    if (location.kind === "section") {
      if (payload.kind === "new-section") {
        const template = SECTION_TEMPLATES.find((entry) => entry.id === payload.templateId);
        if (template) insertTemplateSection(template, location.index);
      } else if (payload.kind === "section") {
        mutate((layout) => moveSection(layout, payload.nodeId, location.index), payload.nodeId);
      }
    }
  };

  const handleColumnResize = (sectionId: string, leftIndex: number, nextLeftWidth: number, commitChange: boolean) => {
    if (!current) return;
    if (!commitChange) {
      resizeBaselineRef.current ??= current.page;
      const nextLayout = resizeColumns(current.page.layout, sectionId, leftIndex, nextLeftWidth, breakpoint);
      setCurrent({ ...current, page: { ...current.page, layout: nextLayout } });
      return;
    }
    const baseline = resizeBaselineRef.current;
    resizeBaselineRef.current = null;
    const baseLayout = baseline?.layout ?? current.page.layout;
    const finalLayout = resizeColumns(baseLayout, sectionId, leftIndex, nextLeftWidth, breakpoint);
    if (baseline) {
      setPast((stack) => [...stack.slice(-MAX_HISTORY + 1), baseline]);
      setFuture([]);
    }
    setCurrent({
      ...current,
      page: { ...current.page, layout: finalLayout, updatedAt: new Date().toISOString() },
    });
    setDirty(true);
    setMessage("");
  };

  const saveDraft = async () => {
    if (!current) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/builder", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: current.page.slug,
          title: current.page.title,
          description: current.page.description,
          showTitle: current.page.showTitle,
          layout: current.page.layout,
          expectedRevision: current.revision,
        }),
      });
      const data = (await response.json()) as { revision?: number; error?: string };
      if (!response.ok || data.revision === undefined) throw new Error(data.error ?? "The page could not be saved.");
      setCurrent((open) => (open ? { ...open, revision: data.revision!, isBuiltinDefault: false } : open));
      setDirty(false);
      setMessage("Draft saved.");
      const list = await loadPages();
      setPages(list.pages);
      setStorePages(list.storePages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The page could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!current) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/builder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          slug: current.page.slug,
          title: current.page.title,
          description: current.page.description,
          showTitle: current.page.showTitle,
          layout: current.page.layout,
          expectedRevision: current.revision,
        }),
      });
      const data = (await response.json()) as { revision?: number; error?: string };
      if (!response.ok || data.revision === undefined) throw new Error(data.error ?? "The page could not be published.");
      setCurrent((open) => (open ? { ...open, revision: data.revision!, published: true, isBuiltinDefault: false } : open));
      setDirty(false);
      setMessage("Published. Visitors can see this page now.");
      const list = await loadPages();
      setPages(list.pages);
      setStorePages(list.storePages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The page could not be published.");
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!current || current.revision === 0) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/builder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unpublish", slug: current.page.slug, expectedRevision: current.revision }),
      });
      const data = (await response.json()) as { revision?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "The page could not be unpublished.");
      setCurrent((open) => (open ? { ...open, revision: data.revision ?? open.revision, published: false } : open));
      setMessage(
        isEditableStoreSlug(current.page.slug)
          ? "Storefront page restored to its original layout. Your custom draft is kept."
          : "Page hidden from visitors. Your draft is kept."
      );
      const list = await loadPages();
      setPages(list.pages);
      setStorePages(list.storePages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The page could not be unpublished.");
    } finally {
      setBusy(false);
    }
  };

  const deletePage = async () => {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/builder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", slug: current.page.slug }),
      });
      if (!response.ok) throw new Error();
      const list = await loadPages();
      setPages(list.pages);
      setStorePages(list.storePages);
      setCurrent(null);
      setDirty(false);
      setConfirmDelete(false);
      setMessage(isEditableStoreSlug(current.page.slug) ? "Custom layout reset to default." : "Page deleted.");
    } catch {
      setError("The page could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const filteredPages = useMemo(() => {
    const q = hubSearch.trim().toLowerCase();
    return pages.filter((p) => {
      if (hubFilter === "published" && !p.published) return false;
      if (hubFilter === "draft" && p.published) return false;
      if (!q) return true;
      return `${p.title} ${p.slug} ${p.description}`.toLowerCase().includes(q);
    });
  }, [pages, hubSearch, hubFilter]);

  /* ---------------------------------------------------------- render hub */

  if (loading) return <p className="hint">Loading pages…</p>;

  if (!current) {
    return (
      <div className="builder-start">
        <div className="builder-start-head">
          <div>
            <h2>Pages & Visual Editor</h2>
            <p className="hint">Edit your storefront pages visually or build custom pages with drag-and-drop sections and blocks.</p>
          </div>
          <button type="button" className="btn" onClick={openCreateModal}>New page</button>
        </div>

        {error ? <p role="alert" className="banner-note is-error">{error}</p> : null}
        {message ? <p role="status" className="banner-note is-ok">{message}</p> : null}

        <section className="builder-hub-section" aria-label="Storefront pages">
          <div className="builder-hub-section-head">
            <h3>Storefront pages</h3>
            <span className="small muted">Edit built-in pages visually or switch back to their default layout anytime.</span>
          </div>
          <div className="builder-store-grid">
            {onOpenHomepageEditor ? (
              <article className="builder-store-card">
                <div>
                  <div className="builder-store-card-top">
                    <span className="builder-badge">Live</span>
                    <span className="small muted">/</span>
                  </div>
                  <h4>Homepage</h4>
                  <p className="small muted">Hero slideshow, sections, featured products, and homepage copy.</p>
                </div>
                <div className="builder-store-card-actions">
                  <button type="button" className="btn btn-sm" onClick={onOpenHomepageEditor}>Edit homepage</button>
                  <a className="link" href="/" target="_blank" rel="noreferrer">View</a>
                </div>
              </article>
            ) : null}

            {storePages.map((entry) => (
              <article key={entry.slug} className="builder-store-card">
                <div>
                  <div className="builder-store-card-top">
                    <span className={`builder-badge${entry.published ? "" : " is-draft"}`}>
                      {entry.published ? "Customized" : entry.customized ? "Draft edits" : "Default"}
                    </span>
                    <span className="small muted">{entry.path}</span>
                  </div>
                  <h4>{entry.title}</h4>
                  <p className="small muted">{entry.description}</p>
                </div>
                <div className="builder-store-card-actions">
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void openPage(entry.slug)}>
                    Edit visually
                  </button>
                  <a className="link" href={entry.path} target="_blank" rel="noreferrer">View</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="builder-hub-section" aria-label="Custom pages">
          <div className="builder-hub-section-head">
            <h3>Custom pages ({pages.length})</h3>
          </div>

          <div className="builder-filter-bar">
            <input
              type="search"
              className="input"
              placeholder="Search pages…"
              aria-label="Search custom pages"
              value={hubSearch}
              onChange={(e) => setHubSearch(e.target.value)}
            />
            <div className="admin-media-tabs">
              {(["all", "published", "draft"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={hubFilter === status ? "is-active" : ""}
                  onClick={() => setHubFilter(status)}
                >
                  {status === "all" ? "All" : status === "published" ? "Published" : "Drafts"}
                </button>
              ))}
            </div>
          </div>

          {filteredPages.length ? (
            <ul className="builder-page-list">
              {filteredPages.map((page) => (
                <li key={page.slug} className="builder-page-row">
                  <div className="builder-page-row-info">
                    <span className="builder-page-title">{page.title || page.slug}</span>
                    <span className="builder-page-meta">
                      /{page.slug} · {page.published ? "Published" : "Draft"} · updated {new Date(page.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="builder-page-row-actions">
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void openPage(page.slug)}>
                      Edit visually
                    </button>
                    <a
                      className="link"
                      href={page.published ? `/${page.slug}` : `/builder-preview?slug=${encodeURIComponent(page.slug)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {page.published ? "View" : "Preview"}
                    </a>
                    <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => void duplicateCustomPage(page.slug)}>
                      Duplicate
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty">
              <h3 className="h3">{hubSearch || hubFilter !== "all" ? "No matching pages" : "No custom pages yet"}</h3>
              <p className="small muted">
                {hubSearch || hubFilter !== "all"
                  ? "Try clearing your search or status filter."
                  : "Create a custom landing page, sizing guide, or group-order page using a starter template."}
              </p>
            </div>
          )}
        </section>

        {createOpen ? (
          <div className="builder-modal-overlay" role="dialog" aria-modal="true" aria-label="Create a new page" onClick={() => setCreateOpen(false)}>
            <form className="builder-modal" onSubmit={createFromModal} onClick={(e) => e.stopPropagation()}>
              <div className="builder-modal-head">
                <h3>New page</h3>
                <button type="button" className="link" onClick={() => setCreateOpen(false)}>Close</button>
              </div>
              {error ? <p role="alert" className="banner-note is-error">{error}</p> : null}
              <div className="field-grid">
                <Field label="Page title">
                  <input
                    className="input"
                    required
                    maxLength={BUILDER_LIMITS.title}
                    placeholder="e.g. Bulk & Team Orders"
                    value={newTitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTitle(val);
                      if (!newSlugEdited) setNewSlug(pageSlugFromTitle(val));
                    }}
                  />
                </Field>
                <Field label="Page address">
                  <input
                    className="input"
                    required
                    maxLength={BUILDER_LIMITS.slug}
                    placeholder="bulk-team-orders"
                    value={newSlug}
                    onChange={(e) => {
                      setNewSlugEdited(true);
                      setNewSlug(e.target.value.toLowerCase());
                    }}
                  />
                </Field>
              </div>
              <div>
                <p className="label" style={{ marginBottom: 8 }}>Choose a starting layout</p>
                <div className="builder-starter-grid">
                  {STARTER_PAGE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className={`builder-starter-card${starterId === tpl.id ? " is-selected" : ""}`}
                      onClick={() => setStarterId(tpl.id)}
                    >
                      <strong>{tpl.name}</strong>
                      <span>{tpl.description}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn">Create & open editor</button>
                <button type="button" className="btn btn-light" onClick={() => setCreateOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    );
  }

  /* -------------------------------------------------------- render studio */

  const page = current.page;
  const isBuiltin = isEditableStoreSlug(page.slug);
  const previewUrl =
    current.published
      ? `/${page.slug}`
      : current.revision > 0
        ? `/builder-preview?slug=${encodeURIComponent(page.slug)}`
        : isBuiltin
          ? `/${page.slug}`
          : "";
  const style = selected ? effectiveStyle(selected, breakpoint) : null;
  const overridden = (key: keyof ElementStyle) => Boolean(selected && isOverridden(selected, breakpoint, key));

  const editorCallbacks: BuilderEditorCallbacks = {
    selectedId,
    breakpoint,
    draggingKind: dragState?.kind ?? null,
    dropLocation,
    onSelect: (id) => setSelectedId(id),
    onInlineCommit: (widgetId, patch) => setNodePatch(widgetId, patch),
    onDragStartNode: (kind, nodeId, event) => startDrag({ kind, nodeId }, event),
    onDragEndNode: endDrag,
    onDragOverLocation: (loc) => setDropLocation(loc),
    onDropAtLocation: (loc) => handleDropAt(loc),
    onAddSectionAfter: (sectionIdx) => addSection(sectionIdx),
    onColumnPreset: (sectionId, widths) => mutate((layout) => setSectionColumnsPreset(layout, sectionId, widths), sectionId),
    onDuplicateNode: (id) => mutate((layout) => duplicateNode(layout, id)),
    onDeleteNode: (id) => removeNodeById(id),
    onColumnResize: handleColumnResize,
    onColumnQuickAdd: (columnId) => {
      setSelectedId(columnId);
      setLeftTab("blocks");
    },
  };

  return (
    <div className="builder">
      {/* ---- Elementor-style dark toolbar ---- */}
      <div className="builder-toolbar">
        <div className="builder-toolbar-left">
          <button type="button" className="builder-toolbar-back" onClick={closePage} title="Back to pages">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <span className="builder-toolbar-title">{page.title || "Untitled page"}</span>
          {dirty ? <span className="builder-toolbar-unsaved">Unsaved</span> : null}
          {current.published ? (
            <span className="builder-badge">Published</span>
          ) : (
            <span className="builder-badge is-draft">{isBuiltin && current.isBuiltinDefault ? "Default" : "Draft"}</span>
          )}
        </div>

        <div className="builder-toolbar-center">
          {BREAKPOINTS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={`builder-toolbar-viewport${breakpoint === entry ? " is-active" : ""}`}
              onClick={() => setBreakpoint(entry)}
              aria-pressed={breakpoint === entry}
              title={BREAKPOINT_LABELS[entry]}
            >
              {entry === "desktop" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
              ) : entry === "tablet" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M12 18h.01" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>
              )}
            </button>
          ))}
        </div>

        <div className="builder-toolbar-right">
          <button type="button" className="builder-toolbar-undo" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5" /></svg>
          </button>
          <button type="button" className="builder-toolbar-redo" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 10H11a5 5 0 00-5 5v2M21 10l-5-5M21 10l-5 5" /></svg>
          </button>
          {previewUrl ? (
            <a className="builder-toolbar-save" href={previewUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              {current.published ? "View" : "Preview"}
            </a>
          ) : null}
          <button type="button" className="builder-toolbar-save" onClick={() => void saveDraft()} disabled={busy}>
            Save Draft
          </button>
          <button type="button" className="builder-toolbar-publish" onClick={() => void publish()} disabled={busy}>
            Publish
          </button>
        </div>
      </div>

      {error ? <p role="alert" className="banner-note is-error" style={{ margin: "0 16px" }}>{error}</p> : null}
      {message ? <p role="status" className="banner-note is-ok" style={{ margin: "0 16px" }}>{message}</p> : null}

      {/* ---- Studio body: left panel + canvas + right panel ---- */}
      <div className="builder-studio">

        {/* ---- LEFT PANEL ---- */}
        <aside className="builder-panel-left">
          <div className="builder-panel-tabs">
            {(
              [
                ["blocks", "Elements"],
                ["templates", "Templates"],
                ["structure", "Navigator"],
                ["page", "Page"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`builder-panel-tab${leftTab === id ? " is-active" : ""}`}
                onClick={() => setLeftTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="builder-panel-body">
            {leftTab === "blocks" ? (
              <>
                <p className="builder-panel-heading">Storefront</p>
                <div className="builder-palette">
                  {STORE_PALETTE.map((entry) => (
                    <button
                      key={entry.kind}
                      type="button"
                      className="builder-palette-item"
                      draggable
                      onDragStart={(e) => startDrag({ kind: "new-widget", widgetKind: entry.kind }, e)}
                      onDragEnd={endDrag}
                      onClick={() => addWidgetToCanvas(entry.kind)}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={WIDGET_ICONS[entry.kind]} /></svg>
                      <strong>{WIDGET_LABELS[entry.kind]}</strong>
                    </button>
                  ))}
                </div>
                <p className="builder-panel-heading">Basic</p>
                <div className="builder-palette">
                  {BASIC_PALETTE.map((entry) => (
                    <button
                      key={entry.kind}
                      type="button"
                      className="builder-palette-item"
                      draggable
                      onDragStart={(e) => startDrag({ kind: "new-widget", widgetKind: entry.kind }, e)}
                      onDragEnd={endDrag}
                      onClick={() => addWidgetToCanvas(entry.kind)}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={WIDGET_ICONS[entry.kind]} /></svg>
                      <strong>{WIDGET_LABELS[entry.kind]}</strong>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn btn-light btn-sm" style={{ marginTop: 12, width: "100%" }} onClick={() => addSection()}>
                  + Add empty section
                </button>
              </>
            ) : null}

            {leftTab === "templates" ? (
              <>
                <p className="builder-panel-heading">Section templates</p>
                <div className="builder-template-list">
                  {SECTION_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      className="builder-template-item"
                      draggable
                      onDragStart={(e) => startDrag({ kind: "new-section", templateId: tpl.id }, e)}
                      onDragEnd={endDrag}
                      onClick={() => insertTemplateSection(tpl)}
                    >
                      <strong>{tpl.name}</strong>
                      <span style={{ color: "var(--el-panel-muted)", fontSize: 12 }}>{tpl.description}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {leftTab === "structure" ? (
              <>
                <p className="builder-panel-heading">Layers</p>
                <ul className="builder-tree">
                  {page.layout.sections.map((section, sIdx) => (
                    <li key={section.id}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => startDrag({ kind: "section", nodeId: section.id }, e)}
                        onDragEnd={endDrag}
                        className={`builder-tree-row${selectedId === section.id ? " is-selected" : ""}`}
                        onClick={() => setSelectedId(section.id)}
                      >
                        <span>⋮⋮ Section {sIdx + 1}</span>
                        <span className="builder-tree-hint">{section.columns.length} col</span>
                      </button>
                      <ul>
                        {section.columns.map((column, cIdx) => (
                          <li key={column.id}>
                            <button
                              type="button"
                              className={`builder-tree-row${selectedId === column.id ? " is-selected" : ""}`}
                              onClick={() => setSelectedId(column.id)}
                            >
                              <span>Column {cIdx + 1}</span>
                              <span className="builder-tree-hint">{column.style.desktop.columnWidth ?? 100}%</span>
                            </button>
                            {column.widgets.length ? (
                              <ul>
                                {column.widgets.map((widget) => (
                                  <li key={widget.id}>
                                    <button
                                      type="button"
                                      draggable
                                      onDragStart={(e) => startDrag({ kind: "widget", nodeId: widget.id }, e)}
                                      onDragEnd={endDrag}
                                      className={`builder-tree-row${selectedId === widget.id ? " is-selected" : ""}`}
                                      onClick={() => setSelectedId(widget.id)}
                                    >
                                      <span>⋮⋮ {nodeLabel(widget)}</span>
                                      {nodeHint(widget) ? <span className="builder-tree-hint">{nodeHint(widget)}</span> : null}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {leftTab === "page" ? (
              <>
                <section className="builder-card">
                  <h3>Page details</h3>
                  <Field label="Title">
                    <input
                      className="input"
                      value={page.title}
                      maxLength={BUILDER_LIMITS.title}
                      onChange={(event) => commit(page.layout, { title: event.target.value })}
                    />
                  </Field>
                  <Field label="Address">
                    <input
                      className="input"
                      value={page.slug}
                      maxLength={BUILDER_LIMITS.slug}
                      disabled={current.revision > 0 || isBuiltin}
                      onChange={(event) => commit(page.layout, { slug: event.target.value.toLowerCase() })}
                    />
                  </Field>
                  <Field label="Summary (search engines)">
                    <textarea
                      className="input"
                      rows={2}
                      maxLength={BUILDER_LIMITS.description}
                      value={page.description}
                      onChange={(event) => commit(page.layout, { description: event.target.value })}
                    />
                  </Field>
                  <label className="builder-check">
                    <input
                      type="checkbox"
                      checked={page.showTitle}
                      onChange={(event) => commit(page.layout, { showTitle: event.target.checked })}
                    />
                    Show the page title at the top
                  </label>
                </section>

                <section className="builder-card builder-danger-zone">
                  <h3>Visibility</h3>
                  {current.published ? (
                    <button type="button" className="link" onClick={() => void unpublish()} disabled={busy}>
                      {isBuiltin ? "Restore default page" : "Hide from visitors"}
                    </button>
                  ) : null}
                  {current.revision > 0 ? (
                    confirmDelete ? (
                      <span className="builder-confirm">
                        <span>{isBuiltin ? "Discard custom layout?" : "Delete this page permanently?"}</span>
                        <button type="button" className="link builder-danger" onClick={() => void deletePage()} disabled={busy}>
                          {isBuiltin ? "Reset" : "Delete"}
                        </button>
                        <button type="button" className="link" onClick={() => setConfirmDelete(false)}>Cancel</button>
                      </span>
                    ) : (
                      <button type="button" className="link builder-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                        {isBuiltin ? "Discard custom layout" : "Delete page"}
                      </button>
                    )
                  ) : null}
                </section>
              </>
            ) : null}
          </div>
        </aside>

        {/* ---- CANVAS AREA ---- */}
        <div className="builder-canvas-area">
          {selected ? (
            <div className="builder-selection-bar">
              <strong>{nodeLabel(selected)}</strong>
              <div>
                <button type="button" className="link" onClick={() => mutate((layout) => moveNodeWithin(layout, selected.id, -1))}>Move up</button>
                <button type="button" className="link" onClick={() => mutate((layout) => moveNodeWithin(layout, selected.id, 1))}>Move down</button>
                <button type="button" className="link" onClick={() => mutate((layout) => duplicateNode(layout, selected.id))}>Duplicate</button>
                <button type="button" className="link builder-danger" onClick={() => removeNodeById(selected.id)}>Delete</button>
              </div>
            </div>
          ) : null}

          <div
            className="builder-canvas-wrap"
            onClick={() => setSelectedId(null)}
            onDragEnd={endDrag}
          >
            <div
              className={`builder-canvas${dragState ? " is-drop-target" : ""}`}
              data-width={breakpoint}
              ref={canvasRef}
            >
              <div className="builder-canvas-frame" style={{ height: frameHeight || undefined }}>
                <div
                  className="builder-canvas-scaler"
                  ref={scalerRef}
                  style={{
                    width: `${targetWidth}px`,
                    transform: `translateX(${Math.max(0, Math.round((available - targetWidth * zoom) / 2))}px) scale(${zoom})`,
                  }}
                >
                  <BuilderPageView
                    page={current.page}
                    editing
                    selectedId={selectedId ?? undefined}
                    callbacks={editorCallbacks}
                    products={products}
                    settings={settings}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---- RIGHT PANEL ---- */}
        <aside className="builder-panel-right">
          <div className="builder-tabs">
            <button type="button" className={panel === "content" ? "is-active" : ""} onClick={() => setPanel("content")}>Content</button>
            <button type="button" className={panel === "style" ? "is-active" : ""} onClick={() => setPanel("style")}>Style</button>
          </div>

          <div className="builder-panel-body">
            {!selected ? (
              <div className="builder-card">
                <p className="hint" style={{ margin: 0 }}>Click any section, column, or block on the page to edit its content and styles.</p>
              </div>
            ) : panel === "content" ? (
              <ContentPanel
                node={selected}
                categories={categories}
                onPatch={(patch) => setNodePatch(selected.id, patch)}
                onAddColumn={selected.kind === "section" ? () => addColumnTo(selected) : undefined}
                onColumnPreset={
                  selected.kind === "section"
                    ? (widths) => mutate((layout) => setSectionColumnsPreset(layout, selected.id, widths), selected.id)
                    : undefined
                }
                onUploadDirect={() => fileInput.current?.click()}
                onPickMedia={openMediaPicker}
                uploading={uploading}
                onBoxed={selected.kind === "section" ? (boxed) => mutate((layout) => updateNode(layout, selected.id, (node) => ({ ...(node as SectionNode), boxed }))) : undefined}
              />
            ) : (
              <StylePanel
                node={selected}
                breakpoint={breakpoint}
                style={style ?? {}}
                overridden={overridden}
                setStyle={(key, value) => setStyle(selected.id, key, value)}
                onPatchNode={(patch) => setNodePatch(selected.id, patch)}
                onPickMedia={openMediaPicker}
              />
            )}

            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadImageForSelected(file);
              }}
            />
          </div>
        </aside>
      </div>

      <MediaPickerModal
        open={Boolean(mediaTarget)}
        onClose={() => setMediaTarget(null)}
        onSelect={(picked) => {
          mediaTarget?.(picked);
          setMediaTarget(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ side panels */

const SECTION_PRESETS: { label: string; widths: number[] }[] = [
  { label: "1 column", widths: [100] },
  { label: "50 / 50", widths: [50, 50] },
  { label: "33 / 67", widths: [33, 67] },
  { label: "67 / 33", widths: [67, 33] },
  { label: "3 columns", widths: [33, 34, 33] },
  { label: "4 columns", widths: [25, 25, 25, 25] },
];

function ContentPanel({
  node,
  categories,
  onPatch,
  onAddColumn,
  onColumnPreset,
  onUploadDirect,
  onPickMedia,
  uploading,
  onBoxed,
}: {
  node: BuilderNode;
  categories: { id: number; name: string; slug: string }[];
  onPatch: (patch: Record<string, unknown>) => void;
  onAddColumn?: () => void;
  onColumnPreset?: (widths: number[]) => void;
  onUploadDirect: () => void;
  onPickMedia: (onPick: (picked: { url: string; alt: string }) => void) => void;
  uploading: boolean;
  onBoxed?: (boxed: boolean) => void;
}) {
  if (node.kind === "section") {
    return (
      <section className="builder-card">
        <h3>Section</h3>
        <label className="builder-check">
          <input type="checkbox" checked={node.boxed} onChange={(event) => onBoxed?.(event.target.checked)} />
          Keep content inside the store width
        </label>
        <p className="hint">Turn off for a full-width background or edge-to-edge banner.</p>
        {onColumnPreset ? (
          <div>
            <span className="label" style={{ marginBottom: 6 }}>Column layout</span>
            <div className="builder-palette">
              {SECTION_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={() => onColumnPreset(preset.widths)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {onAddColumn ? (
          <button type="button" className="btn btn-light btn-sm" onClick={onAddColumn} disabled={node.columns.length >= BUILDER_LIMITS.columns}>
            Add column
          </button>
        ) : null}
      </section>
    );
  }
  if (node.kind === "column") {
    return (
      <section className="builder-card">
        <h3>Column</h3>
        <p className="hint">Drag blocks from the left panel into this column, or drag the divider between columns on the canvas to resize.</p>
      </section>
    );
  }

  switch (node.kind) {
    case "heading":
      return (
        <section className="builder-card">
          <h3>Heading</h3>
          <Field label="Text">
            <textarea className="input" rows={3} maxLength={BUILDER_LIMITS.heading} value={node.text} onChange={(event) => onPatch({ text: event.target.value })} />
          </Field>
          <SelectField
            label="Level"
            value={String(node.level) as "1" | "2" | "3"}
            options={[{ value: "1", label: "Heading 1" }, { value: "2", label: "Heading 2" }, { value: "3", label: "Heading 3" }]}
            onChange={(value) => onPatch({ level: Number(value ?? "2") })}
          />
        </section>
      );
    case "text":
      return (
        <section className="builder-card">
          <h3>Text</h3>
          <Field label="Text">
            <textarea className="input" rows={8} maxLength={BUILDER_LIMITS.text} value={node.text} onChange={(event) => onPatch({ text: event.target.value })} />
          </Field>
        </section>
      );
    case "image":
      return (
        <section className="builder-card">
          <h3>Image</h3>
          {node.src ? <Image className="builder-thumb" src={node.src} alt="" width={320} height={200} style={{ width: "100%", height: "auto" }} /> : <p className="hint">No photo yet. Choose one below.</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-sm" onClick={() => onPickMedia(({ url, alt }) => onPatch({ src: url, ...(alt && !node.alt ? { alt } : {}) }))}>
              {node.src ? "Media library" : "Choose photo"}
            </button>
            <button type="button" className="btn btn-light btn-sm" onClick={onUploadDirect} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>
          {node.src ? <button type="button" className="link" onClick={() => onPatch({ src: "" })}>Remove photo</button> : null}
          <Field label="Description for screen readers">
            <input className="input" maxLength={BUILDER_LIMITS.alt} value={node.alt} onChange={(event) => onPatch({ alt: event.target.value })} />
          </Field>
          <Field label="Links to">
            <input className="input" maxLength={BUILDER_LIMITS.link} placeholder="/contact" value={node.href} onChange={(event) => onPatch({ href: event.target.value })} />
          </Field>
        </section>
      );
    case "button":
      return (
        <section className="builder-card">
          <h3>Button</h3>
          <Field label="Text">
            <input className="input" maxLength={BUILDER_LIMITS.button} value={node.text} onChange={(event) => onPatch({ text: event.target.value })} />
          </Field>
          <Field label="Links to">
            <input className="input" maxLength={BUILDER_LIMITS.link} placeholder="/shop" value={node.href} onChange={(event) => onPatch({ href: event.target.value })} />
          </Field>
          <SelectField
            label="Style"
            value={node.variant}
            options={[{ value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }]}
            onChange={(value) => onPatch({ variant: value ?? "solid" })}
          />
        </section>
      );
    case "spacer":
      return (
        <section className="builder-card">
          <h3>Spacer</h3>
          <NumberField label="Height" value={node.height} min={4} max={240} suffix="px" onChange={(value) => onPatch({ height: value ?? 32 })} />
        </section>
      );
    case "divider":
      return (
        <section className="builder-card">
          <h3>Divider</h3>
          <p className="hint">Adjust spacing and border styling in the Style tab.</p>
        </section>
      );
    case "faq":
      return (
        <section className="builder-card">
          <h3>Questions and answers</h3>
          {node.items.map((item, index) => (
            <div key={index} className="builder-repeat">
              <Field label={`Question ${index + 1}`}>
                <input
                  className="input"
                  maxLength={BUILDER_LIMITS.question}
                  value={item.question}
                  onChange={(event) => {
                    const items = node.items.map((entry, position) => (position === index ? { ...entry, question: event.target.value } : entry));
                    onPatch({ items });
                  }}
                />
              </Field>
              <Field label="Answer">
                <textarea
                  className="input"
                  rows={3}
                  maxLength={BUILDER_LIMITS.answer}
                  value={item.answer}
                  onChange={(event) => {
                    const items = node.items.map((entry, position) => (position === index ? { ...entry, answer: event.target.value } : entry));
                    onPatch({ items });
                  }}
                />
              </Field>
              <button
                type="button"
                className="link builder-danger"
                onClick={() => onPatch({ items: node.items.filter((_, position) => position !== index) })}
              >
                Remove question
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={node.items.length >= BUILDER_LIMITS.faqItems}
            onClick={() => onPatch({ items: [...node.items, { question: "", answer: "" }] })}
          >
            Add question
          </button>
        </section>
      );
    case "promo-banner":
      return (
        <section className="builder-card">
          <h3>Hero / promo banner</h3>
          <Field label="Small label">
            <input className="input" maxLength={BUILDER_LIMITS.eyebrow} value={node.eyebrow} onChange={(e) => onPatch({ eyebrow: e.target.value })} />
          </Field>
          <Field label="Headline">
            <textarea className="input" rows={2} maxLength={BUILDER_LIMITS.heading} value={node.heading} onChange={(e) => onPatch({ heading: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="input" rows={3} maxLength={BUILDER_LIMITS.body} value={node.body} onChange={(e) => onPatch({ body: e.target.value })} />
          </Field>
          <div className="builder-split">
            <Field label="Primary button">
              <input className="input" maxLength={BUILDER_LIMITS.button} value={node.ctaText} onChange={(e) => onPatch({ ctaText: e.target.value })} />
            </Field>
            <Field label="Primary link">
              <input className="input" maxLength={BUILDER_LIMITS.link} value={node.ctaHref} onChange={(e) => onPatch({ ctaHref: e.target.value })} />
            </Field>
          </div>
          <div className="builder-split">
            <Field label="Second button">
              <input className="input" maxLength={BUILDER_LIMITS.button} value={node.secondaryCtaText} onChange={(e) => onPatch({ secondaryCtaText: e.target.value })} />
            </Field>
            <Field label="Second link">
              <input className="input" maxLength={BUILDER_LIMITS.link} value={node.secondaryCtaHref} onChange={(e) => onPatch({ secondaryCtaHref: e.target.value })} />
            </Field>
          </div>
          {node.imageSrc ? <Image className="builder-thumb" src={node.imageSrc} alt="" width={320} height={180} /> : null}
          <div className="form-actions">
            <button type="button" className="btn btn-sm" onClick={() => onPickMedia(({ url, alt }) => onPatch({ imageSrc: url, ...(alt && !node.imageAlt ? { imageAlt: alt } : {}) }))}>
              {node.imageSrc ? "Change background photo" : "Choose photo"}
            </button>
            {node.imageSrc ? <button type="button" className="link" onClick={() => onPatch({ imageSrc: "" })}>Remove</button> : null}
          </div>
          <div className="builder-split">
            <NumberField label="Shade overlay" value={node.overlay} min={0} max={85} suffix="%" onChange={(val) => onPatch({ overlay: val ?? 50 })} />
            <NumberField label="Min height" value={node.minHeight} min={200} max={760} suffix="px" onChange={(val) => onPatch({ minHeight: val ?? 380 })} />
          </div>
          <div className="builder-split">
            <SelectField label="Alignment" value={node.align} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }]} onChange={(val) => onPatch({ align: val ?? "left" })} />
            <SelectField label="Theme" value={node.theme} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} onChange={(val) => onPatch({ theme: val ?? "dark" })} />
          </div>
        </section>
      );
    case "product-grid":
      return (
        <section className="builder-card">
          <h3>Product grid</h3>
          <Field label="Heading">
            <input className="input" maxLength={BUILDER_LIMITS.heading} value={node.heading} onChange={(e) => onPatch({ heading: e.target.value })} />
          </Field>
          <Field label="Introduction">
            <textarea className="input" rows={2} maxLength={BUILDER_LIMITS.subheading} value={node.subheading} onChange={(e) => onPatch({ subheading: e.target.value })} />
          </Field>
          <Field label="Category filter">
            <select className="input" value={node.categorySlug} onChange={(e) => onPatch({ categorySlug: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Product type">
            <select className="input" value={node.kindFilter} onChange={(e) => onPatch({ kindFilter: e.target.value as ProductGridKindFilter })}>
              <option value="">All product types</option>
              <option value="tee">T-shirts</option>
              <option value="polo">Polo shirts</option>
              <option value="longsleeve">Long sleeves</option>
              <option value="fleece">Hoodies & fleece</option>
              <option value="cap">Caps</option>
              <option value="tote">Totes</option>
              <option value="mug">Mugs</option>
            </select>
          </Field>
          <label className="builder-check">
            <input type="checkbox" checked={node.featuredOnly} onChange={(e) => onPatch({ featuredOnly: e.target.checked })} />
            Show featured products only
          </label>
          <div className="builder-split">
            <NumberField label="Max items" value={node.limit} min={1} max={12} onChange={(val) => onPatch({ limit: val ?? 4 })} />
            <SelectField
              label="Columns"
              value={String(node.columns) as "2" | "3" | "4"}
              options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]}
              onChange={(val) => onPatch({ columns: Number(val ?? "4") })}
            />
          </div>
          <div className="builder-split">
            <Field label="Link text">
              <input className="input" maxLength={BUILDER_LIMITS.button} value={node.ctaText} onChange={(e) => onPatch({ ctaText: e.target.value })} />
            </Field>
            <Field label="Link address">
              <input className="input" maxLength={BUILDER_LIMITS.link} value={node.ctaHref} onChange={(e) => onPatch({ ctaHref: e.target.value })} />
            </Field>
          </div>
        </section>
      );
    case "category-strip":
      return (
        <section className="builder-card">
          <h3>Category strip</h3>
          <Field label="Heading">
            <input className="input" maxLength={BUILDER_LIMITS.heading} value={node.heading} onChange={(e) => onPatch({ heading: e.target.value })} />
          </Field>
          {node.items.map((item, idx) => (
            <div key={idx} className="builder-repeat">
              <Field label={`Label ${idx + 1}`}>
                <input
                  className="input"
                  maxLength={BUILDER_LIMITS.label}
                  value={item.label}
                  onChange={(e) => {
                    const items = node.items.map((entry, i) => (i === idx ? { ...entry, label: e.target.value } : entry));
                    onPatch({ items });
                  }}
                />
              </Field>
              <Field label="Link">
                <input
                  className="input"
                  maxLength={BUILDER_LIMITS.link}
                  value={item.href}
                  onChange={(e) => {
                    const items = node.items.map((entry, i) => (i === idx ? { ...entry, href: e.target.value } : entry));
                    onPatch({ items });
                  }}
                />
              </Field>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={() =>
                    onPickMedia(({ url }) => {
                      const items = node.items.map((entry, i) => (i === idx ? { ...entry, imageSrc: url } : entry));
                      onPatch({ items });
                    })
                  }
                >
                  {item.imageSrc ? "Change icon" : "Pick photo"}
                </button>
                {node.items.length > 1 ? (
                  <button type="button" className="link builder-danger" onClick={() => onPatch({ items: node.items.filter((_, i) => i !== idx) })}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={node.items.length >= BUILDER_LIMITS.stripItems}
            onClick={() => onPatch({ items: [...node.items, { label: "Category", href: "/shop", imageSrc: "" }] })}
          >
            Add category link
          </button>
        </section>
      );
    case "feature-cards":
      return (
        <section className="builder-card">
          <h3>Steps & feature cards</h3>
          <Field label="Heading">
            <input className="input" maxLength={BUILDER_LIMITS.heading} value={node.heading} onChange={(e) => onPatch({ heading: e.target.value })} />
          </Field>
          <Field label="Introduction">
            <textarea className="input" rows={2} maxLength={BUILDER_LIMITS.subheading} value={node.subheading} onChange={(e) => onPatch({ subheading: e.target.value })} />
          </Field>
          <div className="builder-split">
            <SelectField label="Style" value={node.variant} options={[{ value: "steps", label: "Numbered steps" }, { value: "cards", label: "Feature cards" }]} onChange={(val) => onPatch({ variant: val ?? "cards" })} />
            <SelectField label="Columns" value={String(node.columns) as "2" | "3" | "4"} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} onChange={(val) => onPatch({ columns: Number(val ?? "3") })} />
          </div>
          {node.items.map((item, idx) => (
            <div key={idx} className="builder-repeat">
              <div className="builder-split">
                <Field label="Step / label">
                  <input
                    className="input"
                    maxLength={BUILDER_LIMITS.badge}
                    value={item.badge}
                    onChange={(e) => {
                      const items = node.items.map((entry, i) => (i === idx ? { ...entry, badge: e.target.value } : entry));
                      onPatch({ items });
                    }}
                  />
                </Field>
                <Field label="Title">
                  <input
                    className="input"
                    maxLength={BUILDER_LIMITS.cardTitle}
                    value={item.title}
                    onChange={(e) => {
                      const items = node.items.map((entry, i) => (i === idx ? { ...entry, title: e.target.value } : entry));
                      onPatch({ items });
                    }}
                  />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  className="input"
                  rows={2}
                  maxLength={BUILDER_LIMITS.cardBody}
                  value={item.body}
                  onChange={(e) => {
                    const items = node.items.map((entry, i) => (i === idx ? { ...entry, body: e.target.value } : entry));
                    onPatch({ items });
                  }}
                />
              </Field>
              {node.items.length > 1 ? (
                <button type="button" className="link builder-danger" onClick={() => onPatch({ items: node.items.filter((_, i) => i !== idx) })}>
                  Remove card
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={node.items.length >= BUILDER_LIMITS.featureItems}
            onClick={() => onPatch({ items: [...node.items, { badge: `0${node.items.length + 1}`, title: "New step", body: "Describe this step." }] })}
          >
            Add card
          </button>
        </section>
      );
    case "image-gallery":
      return (
        <section className="builder-card">
          <h3>Photo gallery</h3>
          <Field label="Heading">
            <input className="input" maxLength={BUILDER_LIMITS.heading} value={node.heading} onChange={(e) => onPatch({ heading: e.target.value })} />
          </Field>
          <div className="builder-split">
            <SelectField label="Columns" value={String(node.columns) as "2" | "3" | "4"} options={[{ value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }]} onChange={(val) => onPatch({ columns: Number(val ?? "4") })} />
            <NumberField label="Aspect ratio" value={node.aspectRatio} min={0.5} max={2.5} step={0.1} onChange={(val) => onPatch({ aspectRatio: val ?? 1 })} />
          </div>
          {node.items.map((item, idx) => (
            <div key={idx} className="builder-repeat">
              {item.src ? <Image className="builder-thumb" src={item.src} alt="" width={240} height={140} /> : null}
              <button
                type="button"
                className="btn btn-light btn-sm"
                onClick={() =>
                  onPickMedia(({ url, alt }) => {
                    const items = node.items.map((entry, i) => (i === idx ? { ...entry, src: url, ...(alt && !entry.alt ? { alt } : {}) } : entry));
                    onPatch({ items });
                  })
                }
              >
                {item.src ? "Replace photo" : "Choose photo"}
              </button>
              <Field label="Caption">
                <input
                  className="input"
                  maxLength={BUILDER_LIMITS.caption}
                  value={item.caption}
                  onChange={(e) => {
                    const items = node.items.map((entry, i) => (i === idx ? { ...entry, caption: e.target.value } : entry));
                    onPatch({ items });
                  }}
                />
              </Field>
              <Field label="Link (optional)">
                <input
                  className="input"
                  maxLength={BUILDER_LIMITS.link}
                  value={item.href}
                  onChange={(e) => {
                    const items = node.items.map((entry, i) => (i === idx ? { ...entry, href: e.target.value } : entry));
                    onPatch({ items });
                  }}
                />
              </Field>
              {node.items.length > 1 ? (
                <button type="button" className="link builder-danger" onClick={() => onPatch({ items: node.items.filter((_, i) => i !== idx) })}>
                  Remove photo
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-light btn-sm"
            disabled={node.items.length >= BUILDER_LIMITS.galleryItems}
            onClick={() => onPatch({ items: [...node.items, { src: "", alt: "", caption: "New item", href: "" }] })}
          >
            Add photo card
          </button>
        </section>
      );
    case "contact-block":
      return (
        <section className="builder-card">
          <h3>Contact form</h3>
          <Field label="Heading">
            <input className="input" maxLength={BUILDER_LIMITS.heading} value={node.heading} onChange={(e) => onPatch({ heading: e.target.value })} />
          </Field>
          <Field label="Introduction">
            <textarea className="input" rows={3} maxLength={BUILDER_LIMITS.body} value={node.body} onChange={(e) => onPatch({ body: e.target.value })} />
          </Field>
          <label className="builder-check">
            <input type="checkbox" checked={node.showDetails} onChange={(e) => onPatch({ showDetails: e.target.checked })} />
            Show store contact details
          </label>
          <label className="builder-check">
            <input type="checkbox" checked={node.showQuickLinks} onChange={(e) => onPatch({ showQuickLinks: e.target.checked })} />
            Show FAQ and shipping links
          </label>
        </section>
      );
    default:
      return null;
  }
}

function StylePanel({
  node,
  breakpoint,
  style,
  overridden,
  setStyle,
  onPatchNode,
  onPickMedia,
}: {
  node: BuilderNode;
  breakpoint: Breakpoint;
  style: ElementStyle;
  overridden: (key: keyof ElementStyle) => boolean;
  setStyle: (key: keyof ElementStyle, value: number | string | undefined) => void;
  onPatchNode: (patch: Record<string, unknown>) => void;
  onPickMedia: (onPick: (picked: { url: string; alt: string }) => void) => void;
}) {
  const isText =
    node.kind === "heading" ||
    node.kind === "text" ||
    node.kind === "button" ||
    node.kind === "faq" ||
    node.kind === "feature-cards";
  const isBox = node.kind === "section" || node.kind === "column";

  return (
    <>
      {node.kind === "column" ? (
        <section className="builder-card">
          <h3>Column width</h3>
          <NumberField label="Width" value={style.columnWidth} min={10} max={100} suffix="%" overridden={overridden("columnWidth")} onChange={(value) => setStyle("columnWidth", value)} />
          <p className="hint">Columns stack automatically on phones unless you set a mobile width.</p>
        </section>
      ) : null}

      {isBox ? (
        <section className="builder-card">
          <h3>Background photo</h3>
          {node.backgroundImage ? (
            <Image className="builder-thumb" src={node.backgroundImage} alt="" width={320} height={150} />
          ) : null}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-light btn-sm"
              onClick={() => onPickMedia(({ url }) => onPatchNode({ backgroundImage: url }))}
            >
              {node.backgroundImage ? "Change photo" : "Choose photo"}
            </button>
            {node.backgroundImage ? (
              <button type="button" className="link" onClick={() => onPatchNode({ backgroundImage: undefined, backgroundOverlay: undefined })}>
                Remove
              </button>
            ) : null}
          </div>
          {node.backgroundImage ? (
            <NumberField
              label="Photo shade"
              value={node.backgroundOverlay}
              min={0}
              max={85}
              suffix="%"
              onChange={(value) => onPatchNode({ backgroundOverlay: value })}
            />
          ) : null}
        </section>
      ) : null}

      {isText ? (
        <section className="builder-card">
          <h3>Typography</h3>
          <div className="builder-split">
            <SelectField<FontFamilyChoice>
              label="Font"
              value={style.fontFamily}
              options={[{ value: "body", label: "Body" }, { value: "display", label: "Display" }]}
              onChange={(value) => setStyle("fontFamily", value)}
            />
            <SelectField<TextTransformChoice>
              label="Case"
              value={style.textTransform}
              options={[{ value: "none", label: "Normal" }, { value: "uppercase", label: "Uppercase" }]}
              onChange={(value) => setStyle("textTransform", value)}
            />
          </div>
          <div className="builder-split">
            <NumberField label="Size" value={style.fontSize} min={10} max={96} suffix="px" overridden={overridden("fontSize")} onChange={(value) => setStyle("fontSize", value)} />
            <NumberField label="Weight" value={style.fontWeight} min={300} max={900} overridden={overridden("fontWeight")} onChange={(value) => setStyle("fontWeight", value)} />
          </div>
          <div className="builder-split">
            <NumberField label="Line height" value={style.lineHeight} min={0.9} max={3} step={0.1} overridden={overridden("lineHeight")} onChange={(value) => setStyle("lineHeight", value)} />
            <NumberField label="Letter spacing" value={style.letterSpacing} min={-2} max={12} suffix="px" overridden={overridden("letterSpacing")} onChange={(value) => setStyle("letterSpacing", value)} />
          </div>
          <SelectField
            label="Alignment"
            value={style.textAlign}
            options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }]}
            onChange={(value) => setStyle("textAlign", value)}
          />
          <ColourField label="Text colour" value={style.textColor} onChange={(value) => setStyle("textColor", value)} />
        </section>
      ) : null}

      {node.kind === "image" ? (
        <section className="builder-card">
          <h3>Image</h3>
          <NumberField label="Aspect ratio" value={style.aspectRatio} min={0.4} max={3} step={0.1} overridden={overridden("aspectRatio")} onChange={(value) => setStyle("aspectRatio", value)} />
          <p className="hint">Try 1.5 for landscape, 1 for square. Leave blank to keep original proportions.</p>
          <SelectField
            label="Fit"
            value={style.objectFit}
            options={[{ value: "cover", label: "Fill the frame" }, { value: "contain", label: "Show the whole photo" }]}
            onChange={(value) => setStyle("objectFit", value)}
          />
        </section>
      ) : null}

      <section className="builder-card">
        <h3>Spacing</h3>
        <div className="builder-split">
          <NumberField label="Top" value={style.paddingTop} min={0} max={160} suffix="px" overridden={overridden("paddingTop")} onChange={(value) => setStyle("paddingTop", value)} />
          <NumberField label="Bottom" value={style.paddingBottom} min={0} max={160} suffix="px" overridden={overridden("paddingBottom")} onChange={(value) => setStyle("paddingBottom", value)} />
        </div>
        <div className="builder-split">
          <NumberField label="Left" value={style.paddingLeft} min={0} max={160} suffix="px" overridden={overridden("paddingLeft")} onChange={(value) => setStyle("paddingLeft", value)} />
          <NumberField label="Right" value={style.paddingRight} min={0} max={160} suffix="px" overridden={overridden("paddingRight")} onChange={(value) => setStyle("paddingRight", value)} />
        </div>
        <div className="builder-split">
          <NumberField label="Space above" value={style.marginTop} min={0} max={160} suffix="px" overridden={overridden("marginTop")} onChange={(value) => setStyle("marginTop", value)} />
          <NumberField label="Space below" value={style.marginBottom} min={0} max={160} suffix="px" overridden={overridden("marginBottom")} onChange={(value) => setStyle("marginBottom", value)} />
        </div>
        {isBox ? (
          <NumberField label="Gap between blocks" value={style.gap} min={0} max={80} suffix="px" overridden={overridden("gap")} onChange={(value) => setStyle("gap", value)} />
        ) : null}
        {node.kind === "column" ? (
          <SelectField
            label="Vertical alignment"
            value={style.verticalAlign}
            options={[{ value: "start", label: "Top" }, { value: "center", label: "Middle" }, { value: "end", label: "Bottom" }]}
            onChange={(value) => setStyle("verticalAlign", value)}
          />
        ) : null}
      </section>

      <section className="builder-card">
        <h3>Box & border</h3>
        <ColourField label="Background" value={style.backgroundColor} onChange={(value) => setStyle("backgroundColor", value)} />
        <div className="builder-split">
          <NumberField label="Border" value={style.borderWidth} min={0} max={12} suffix="px" overridden={overridden("borderWidth")} onChange={(value) => setStyle("borderWidth", value)} />
          <NumberField label="Corner radius" value={style.borderRadius} min={0} max={80} suffix="px" overridden={overridden("borderRadius")} onChange={(value) => setStyle("borderRadius", value)} />
        </div>
        <ColourField label="Border colour" value={style.borderColor} onChange={(value) => setStyle("borderColor", value)} />
        <div className="builder-split">
          <NumberField label="Min height" value={style.minHeight} min={0} max={900} suffix="px" overridden={overridden("minHeight")} onChange={(value) => setStyle("minHeight", value)} />
          <NumberField label="Maximum width" value={style.maxWidth} min={0} max={1600} suffix="px" overridden={overridden("maxWidth")} onChange={(value) => setStyle("maxWidth", value)} />
        </div>
        <SelectField<BoxShadow>
          label="Shadow"
          value={style.boxShadow}
          options={[
            { value: "none", label: "None" },
            { value: "sm", label: "Subtle" },
            { value: "md", label: "Medium" },
            { value: "lg", label: "Pronounced" },
          ]}
          onChange={(value) => setStyle("boxShadow", value)}
        />
      </section>

      <p className="hint">
        {breakpoint === "desktop"
          ? "Desktop values are the base. Switch to tablet or mobile to override just that screen."
          : `Editing ${BREAKPOINT_LABELS[breakpoint].toLowerCase()} only. Clear a field to inherit the wider screen.`}
      </p>
    </>
  );
}
