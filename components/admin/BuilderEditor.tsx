"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import BuilderPageView from "@/components/builder/BuilderPageView";
import {
  BREAKPOINTS,
  BREAKPOINT_LABELS,
  BUILDER_LIMITS,
  WIDGET_LABELS,
  isBuilderSlug,
  newColumn,
  newLayout,
  newSection,
  newWidget,
  type Breakpoint,
  type BuilderLayout,
  type BuilderNode,
  type BuilderPage,
  type ElementStyle,
  type SectionNode,
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
  removeNode,
  updateNode,
} from "@/lib/builder/tree";

type Summary = {
  slug: string;
  title: string;
  description: string;
  revision: number;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

type OpenPage = { page: BuilderPage; revision: number; published: boolean };
type Panel = "content" | "style";
type PaletteKind = WidgetKind;

const PALETTE: { kind: PaletteKind; hint: string }[] = [
  { kind: "heading", hint: "Section title" },
  { kind: "text", hint: "Paragraph copy" },
  { kind: "image", hint: "Photo or graphic" },
  { kind: "button", hint: "Link to a page" },
  { kind: "faq", hint: "Questions and answers" },
  { kind: "spacer", hint: "Vertical space" },
  { kind: "divider", hint: "Thin line" },
];

const MAX_HISTORY = 60;

function blankPage(slug: string): BuilderPage {
  return {
    slug,
    title: "",
    description: "",
    showTitle: true,
    layout: newLayout(),
    updatedAt: new Date().toISOString(),
  };
}

function nodeLabel(node: BuilderNode): string {
  if (node.kind === "section") return `Section · ${node.columns.length} column${node.columns.length === 1 ? "" : "s"}`;
  if (node.kind === "column") return `Column · ${node.style.desktop.columnWidth ?? 100}% wide`;
  return WIDGET_LABELS[node.kind];
}

/** Reads the first widget text so the structure list is recognisable. */
function nodeHint(node: BuilderNode): string {
  if (node.kind === "heading" || node.kind === "text" || node.kind === "button") return node.text.slice(0, 40);
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

export default function BuilderEditor({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [pages, setPages] = useState<Summary[]>([]);
  const [current, setCurrent] = useState<OpenPage | null>(null);
  const [past, setPast] = useState<BuilderPage[]>([]);
  const [future, setFuture] = useState<BuilderPage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");
  const [panel, setPanel] = useState<Panel>("content");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dropColumn, setDropColumn] = useState<string | null>(null);
  const dragKind = useRef<WidgetKind | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scalerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [frameHeight, setFrameHeight] = useState(0);
  const [available, setAvailable] = useState(0);

  const targetWidth = breakpoint === "desktop" ? 1280 : breakpoint === "tablet" ? 820 : 390;

  // The canvas is a real page at the target width, scaled down to fit the admin
  // column, so a desktop preview is never mistaken for a tablet one.
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

  const loadPages = useCallback(async (): Promise<Summary[]> => {
    const response = await fetch("/api/admin/builder", { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = (await response.json()) as { pages?: Summary[] };
    return data.pages ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await loadPages();
        if (!cancelled) setPages(list);
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
      const data = (await response.json()) as { page: BuilderPage; revision: number; published: boolean };
      setCurrent({ page: data.page, revision: data.revision, published: data.published });
      setPast([]);
      setFuture([]);
      setSelectedId(null);
      setDirty(false);
      setConfirmDelete(false);
      setPanel("content");
    } catch {
      setError("Could not open that page. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const startNewPage = () => {
    const slug = `page-${Date.now().toString(36)}`;
    setCurrent({ page: blankPage(slug), revision: 0, published: false });
    setPast([]);
    setFuture([]);
    setSelectedId(null);
    setDirty(true);
    setMessage("");
    setError("");
  };

  const closePage = () => {
    if (dirty && !window.confirm("Discard unsaved changes to this page?")) return;
    setCurrent(null);
    setDirty(false);
    setSelectedId(null);
    setError("");
    setMessage("");
  };

  const commit = (layout: BuilderLayout, patch: Partial<BuilderPage> = {}) => {
    if (!current) return;
    setPast((stack) => [...stack.slice(-MAX_HISTORY + 1), current.page]);
    setFuture([]);
    setCurrent({
      ...current,
      page: { ...current.page, ...patch, layout, updatedAt: new Date().toISOString() },
    });
    setDirty(true);
    setMessage("");
  };

  const undo = () => {
    if (!current || !past.length) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([current.page, ...future].slice(0, MAX_HISTORY));
    setCurrent({ ...current, page: previous });
    setDirty(true);
  };

  const redo = () => {
    if (!current || !future.length) return;
    const next = future[0];
    setPast([...past.slice(-MAX_HISTORY + 1), current.page]);
    setFuture(future.slice(1));
    setCurrent({ ...current, page: next });
    setDirty(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (typing || !current) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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

  const setWidget = (id: string, patch: Record<string, unknown>) => {
    if (!current) return;
    commit(updateNode(current.page.layout, id, (node) => ({ ...node, ...patch }) as BuilderNode));
  };

  const mutate = (work: (layout: BuilderLayout) => BuilderLayout, nextSelection?: string | null) => {
    if (!current) return;
    commit(work(current.page.layout));
    if (nextSelection !== undefined) setSelectedId(nextSelection);
  };

  const addWidgetToCanvas = (kind: WidgetKind, columnId?: string) => {
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
    commit(insertWidget(current.page.layout, target, widget));
    setSelectedId(widget.id);
  };

  const addSection = () => {
    if (!current) return;
    const section = newSection();
    commit(insertSection(current.page.layout, section));
    setSelectedId(section.id);
  };

  const addColumnTo = (section: SectionNode) => {
    if (!current) return;
    const column = newColumn();
    commit(insertColumn(current.page.layout, section.id, column));
    setSelectedId(column.id);
  };

  const removeSelected = () => {
    if (!current || !selected) return;
    const parent = selected.kind === "column" ? current.page.layout.sections.find((section) => section.columns.some((column) => column.id === selected.id)) : null;
    if (selected.kind === "section" && current.page.layout.sections.length <= 1) {
      setMessage("Every page needs at least one section.");
      return;
    }
    if (selected.kind === "column" && parent && parent.columns.length <= 1) {
      setMessage("A section needs at least one column. Delete the section instead.");
      return;
    }
    commit(removeNode(current.page.layout, selected.id));
    setSelectedId(null);
  };

  const uploadImage = async (file: File) => {
    if (!selected || selected.kind !== "image") return;
    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      body.set("image", file);
      const response = await fetch("/api/admin/product-media", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error);
      setWidget(selected.id, { src: data.url });
    } catch {
      setError("The photo could not be uploaded. Try a JPG, PNG or WebP file.");
    } finally {
      setUploading(false);
    }
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
      setCurrent((open) => (open ? { ...open, revision: data.revision! } : open));
      setDirty(false);
      setMessage("Draft saved.");
      setPages(await loadPages());
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
      setCurrent((open) => (open ? { ...open, revision: data.revision!, published: true } : open));
      setDirty(false);
      setMessage("Published. Visitors can see this page now.");
      setPages(await loadPages());
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
      setMessage("Page hidden from visitors. Your draft is kept.");
      setPages(await loadPages());
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
      setPages(await loadPages());
      setCurrent(null);
      setDirty(false);
      setConfirmDelete(false);
      setMessage("Page deleted.");
    } catch {
      setError("The page could not be deleted.");
    } finally {
      setBusy(false);
    }
  };

  const style = selected ? effectiveStyle(selected, breakpoint) : null;
  const overridden = (key: keyof ElementStyle) => Boolean(selected && isOverridden(selected, breakpoint, key));
  const canvas = current ? (
    <div
      className={`builder-canvas${dropColumn ? " is-drop-target" : ""}`}
      data-width={breakpoint}
      ref={canvasRef}
      onDragEnd={() => {
        dragKind.current = null;
        setDropColumn(null);
      }}
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
          <BuilderPageView page={current.page} editing selectedId={selectedId ?? undefined} />
        </div>
      </div>
    </div>
  ) : null;

  /* -------------------------------------------------------------- render */

  if (loading) return <p className="hint">Loading pages…</p>;

  if (!current) {
    return (
      <div className="builder-start">
        <div className="builder-start-head">
          <div>
            <h2>Page builder</h2>
            <p className="hint">Build pages with sections, columns and styled blocks, then publish them at their own address.</p>
          </div>
          <button type="button" className="btn" onClick={startNewPage}>New page</button>
        </div>

        {error ? <p role="alert" className="form-error">{error}</p> : null}
        {message ? <p role="status" className="form-note">{message}</p> : null}

        {pages.length ? (
          <ul className="builder-page-list">
            {pages.map((page) => (
              <li key={page.slug}>
                <button type="button" className="builder-page-open" onClick={() => void openPage(page.slug)} disabled={busy}>
                  <span className="builder-page-title">{page.title || page.slug}</span>
                  <span className="builder-page-meta">
                    /{page.slug} · {page.published ? "Published" : "Draft"} · updated {new Date(page.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No pages yet. Create one to start building.</p>
        )}
      </div>
    );
  }

  const page = current.page;
  const previewUrl = current.published ? `/${page.slug}` : `/builder-preview?slug=${encodeURIComponent(page.slug)}`;

  return (
    <div className="builder">
      <div className="builder-bar">
        <button type="button" className="link builder-back" onClick={closePage}>← Pages</button>
        <div className="builder-bar-title">
          <strong>{page.title || "Untitled page"}</strong>
          <span className="hint">/{page.slug}</span>
          {dirty ? <span className="builder-unsaved">Unsaved changes</span> : null}
          {current.published ? <span className="builder-badge">Published</span> : <span className="builder-badge is-draft">Draft</span>}
        </div>
        <div className="builder-bar-actions">
          <button type="button" className="link" onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">Undo</button>
          <button type="button" className="link" onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">Redo</button>
          <a className="link" href={previewUrl} target="_blank" rel="noreferrer">{current.published ? "View page" : "Preview draft"}</a>
          <button type="button" className="btn btn-outline" onClick={() => void saveDraft()} disabled={busy}>Save draft</button>
          <button type="button" className="btn" onClick={() => void publish()} disabled={busy}>Publish</button>
        </div>
      </div>

      {error ? <p role="alert" className="form-error">{error}</p> : null}
      {message ? <p role="status" className="form-note">{message}</p> : null}

      <div className="builder-grid">
        <aside className="builder-left">
          <section className="builder-card">
            <h3>Page</h3>
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
                disabled={current.revision > 0}
                onChange={(event) => commit(page.layout, { slug: event.target.value.toLowerCase() })}
              />
            </Field>
            {current.revision > 0 ? (
              <p className="hint">The address is fixed once the page exists. Create a new page to use a different one.</p>
            ) : !isBuilderSlug(page.slug) ? (
              <p className="hint">Use lowercase letters, numbers and dashes. This address is not available.</p>
            ) : null}
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

          <section className="builder-card">
            <h3>Add a block</h3>
            <p className="hint">Click to add, or drag into a column.</p>
            <div className="builder-palette">
              {PALETTE.map((entry) => (
                <button
                  key={entry.kind}
                  type="button"
                  className="builder-palette-item"
                  draggable
                  onDragStart={(event) => {
                    dragKind.current = entry.kind;
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData("text/plain", entry.kind);
                  }}
                  onClick={() => addWidgetToCanvas(entry.kind)}
                >
                  <strong>{WIDGET_LABELS[entry.kind]}</strong>
                  <span>{entry.hint}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-outline builder-add-section" onClick={addSection}>Add section</button>
          </section>

          <section className="builder-card">
            <h3>Structure</h3>
            <ul className="builder-tree">
              {page.layout.sections.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    className={`builder-tree-row${selectedId === section.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedId(section.id)}
                  >
                    {nodeLabel(section)}
                  </button>
                  <ul>
                    {section.columns.map((column) => (
                      <li key={column.id}>
                        <button
                          type="button"
                          className={`builder-tree-row${selectedId === column.id ? " is-selected" : ""}`}
                          onClick={() => setSelectedId(column.id)}
                        >
                          {nodeLabel(column)}
                        </button>
                        {column.widgets.length ? (
                          <ul>
                            {column.widgets.map((widget) => (
                              <li key={widget.id}>
                                <button
                                  type="button"
                                  className={`builder-tree-row${selectedId === widget.id ? " is-selected" : ""}`}
                                  onClick={() => setSelectedId(widget.id)}
                                >
                                  <span>{nodeLabel(widget)}</span>
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
          </section>
        </aside>

        <div className="builder-main">
          <div className="builder-viewports">
            {BREAKPOINTS.map((entry) => (
              <button
                key={entry}
                type="button"
                className={breakpoint === entry ? "is-active" : ""}
                onClick={() => setBreakpoint(entry)}
                aria-pressed={breakpoint === entry}
              >
                {BREAKPOINT_LABELS[entry]}
              </button>
            ))}
            <span className="hint">Styles you change here apply to {BREAKPOINT_LABELS[breakpoint].toLowerCase()}.</span>
          </div>

          {selected ? (
            <div className="builder-selection-bar">
              <strong>{nodeLabel(selected)}</strong>
              <div>
                <button type="button" className="link" onClick={() => mutate((layout) => moveNodeWithin(layout, selected.id, -1))}>Move up</button>
                <button type="button" className="link" onClick={() => mutate((layout) => moveNodeWithin(layout, selected.id, 1))}>Move down</button>
                <button type="button" className="link" onClick={() => mutate((layout) => duplicateNode(layout, selected.id))}>Duplicate</button>
                <button type="button" className="link builder-danger" onClick={removeSelected}>Delete</button>
              </div>
            </div>
          ) : null}

          <div
            className="builder-canvas-wrap"
            onClick={() => setSelectedId(null)}
            onDragOver={(event) => {
              if (!dragKind.current) return;
              event.preventDefault();
              const column = (event.target as HTMLElement).closest<HTMLElement>("[data-b-column]");
              setDropColumn(column?.dataset.bColumn ?? null);
            }}
            onDragLeave={(event) => {
              if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) setDropColumn(null);
            }}
            onDrop={(event) => {
              const kind = dragKind.current;
              const column = (event.target as HTMLElement).closest<HTMLElement>("[data-b-column]");
              dragKind.current = null;
              setDropColumn(null);
              if (!kind || !column?.dataset.bColumn) return;
              event.preventDefault();
              addWidgetToCanvas(kind, column.dataset.bColumn);
            }}
          >
            <div
              onClick={(event) => {
                const target = (event.target as HTMLElement).closest<HTMLElement>("[data-b-id]");
                if (!target) return;
                event.stopPropagation();
                setSelectedId(target.dataset.bId ?? null);
              }}
            >
              {canvas}
            </div>
          </div>
        </div>

        <aside className="builder-right">
          <div className="builder-tabs">
            <button type="button" className={panel === "content" ? "is-active" : ""} onClick={() => setPanel("content")}>Content</button>
            <button type="button" className={panel === "style" ? "is-active" : ""} onClick={() => setPanel("style")}>Style</button>
          </div>

          {!selected ? (
            <p className="hint">Select a section, column or block in the canvas or the structure list.</p>
          ) : panel === "content" ? (
            <ContentPanel
              node={selected}
              onText={(patch) => setWidget(selected.id, patch)}
              onAddColumn={selected.kind === "section" ? () => addColumnTo(selected) : undefined}
              onUpload={() => fileInput.current?.click()}
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
              if (file) void uploadImage(file);
            }}
          />

          <section className="builder-card builder-danger-zone">
            <h3>This page</h3>
            {current.published ? (
              <button type="button" className="link" onClick={() => void unpublish()} disabled={busy}>Hide from visitors</button>
            ) : null}
            {confirmDelete ? (
              <span className="builder-confirm">
                <span>Delete this page permanently?</span>
                <button type="button" className="link builder-danger" onClick={() => void deletePage()} disabled={busy}>Delete</button>
                <button type="button" className="link" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </span>
            ) : (
              <button type="button" className="link builder-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete page</button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ side panels */

function ContentPanel({
  node,
  onText,
  onAddColumn,
  onUpload,
  uploading,
  onBoxed,
}: {
  node: BuilderNode;
  onText: (patch: Record<string, unknown>) => void;
  onAddColumn?: () => void;
  onUpload: () => void;
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
        <p className="hint">Turn this off for a full-width background or a banner that reaches the screen edges.</p>
        {onAddColumn ? <button type="button" className="btn btn-outline" onClick={onAddColumn} disabled={node.columns.length >= BUILDER_LIMITS.columns}>Add column</button> : null}
      </section>
    );
  }
  if (node.kind === "column") {
    return (
      <section className="builder-card">
        <h3>Column</h3>
        <p className="hint">Drag blocks from the left panel into a column, or select a block to edit it.</p>
      </section>
    );
  }

  switch (node.kind) {
    case "heading":
      return (
        <section className="builder-card">
          <h3>Heading</h3>
          <Field label="Text">
            <textarea className="input" rows={3} maxLength={BUILDER_LIMITS.heading} value={node.text} onChange={(event) => onText({ text: event.target.value })} />
          </Field>
          <SelectField
            label="Level"
            value={String(node.level) as "1" | "2" | "3"}
            options={[{ value: "1", label: "Heading 1" }, { value: "2", label: "Heading 2" }, { value: "3", label: "Heading 3" }]}
            onChange={(value) => onText({ level: Number(value ?? "2") })}
          />
        </section>
      );
    case "text":
      return (
        <section className="builder-card">
          <h3>Text</h3>
          <Field label="Text">
            <textarea className="input" rows={8} maxLength={BUILDER_LIMITS.text} value={node.text} onChange={(event) => onText({ text: event.target.value })} />
          </Field>
        </section>
      );
    case "image":
      return (
        <section className="builder-card">
          <h3>Image</h3>
          {node.src ? <Image className="builder-thumb" src={node.src} alt="" width={320} height={200} style={{ width: "100%", height: "auto" }} /> : <p className="hint">No photo yet. Choose one below.</p>}
          <button type="button" className="btn btn-outline" onClick={onUpload} disabled={uploading}>{uploading ? "Uploading…" : node.src ? "Replace photo" : "Choose photo"}</button>
          {node.src ? <button type="button" className="link" onClick={() => onText({ src: "" })}>Remove photo</button> : null}
          <Field label="Description for screen readers">
            <input className="input" maxLength={BUILDER_LIMITS.alt} value={node.alt} onChange={(event) => onText({ alt: event.target.value })} />
          </Field>
          <Field label="Links to">
            <input className="input" maxLength={BUILDER_LIMITS.link} placeholder="/contact" value={node.href} onChange={(event) => onText({ href: event.target.value })} />
          </Field>
        </section>
      );
    case "button":
      return (
        <section className="builder-card">
          <h3>Button</h3>
          <Field label="Text">
            <input className="input" maxLength={BUILDER_LIMITS.button} value={node.text} onChange={(event) => onText({ text: event.target.value })} />
          </Field>
          <Field label="Links to">
            <input className="input" maxLength={BUILDER_LIMITS.link} placeholder="/shop" value={node.href} onChange={(event) => onText({ href: event.target.value })} />
          </Field>
          <SelectField
            label="Style"
            value={node.variant}
            options={[{ value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }]}
            onChange={(value) => onText({ variant: value ?? "solid" })}
          />
        </section>
      );
    case "spacer":
      return (
        <section className="builder-card">
          <h3>Spacer</h3>
          <NumberField label="Height" value={node.height} min={4} max={240} suffix="px" onChange={(value) => onText({ height: value ?? 32 })} />
        </section>
      );
    case "divider":
      return (
        <section className="builder-card">
          <h3>Divider</h3>
          <p className="hint">Set the line colour in the Style tab.</p>
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
                    onText({ items });
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
                    onText({ items });
                  }}
                />
              </Field>
              <button
                type="button"
                className="link builder-danger"
                onClick={() => onText({ items: node.items.filter((_, position) => position !== index) })}
              >
                Remove question
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline"
            disabled={node.items.length >= BUILDER_LIMITS.faqItems}
            onClick={() => onText({ items: [...node.items, { question: "", answer: "" }] })}
          >
            Add question
          </button>
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
}: {
  node: BuilderNode;
  breakpoint: Breakpoint;
  style: ElementStyle;
  overridden: (key: keyof ElementStyle) => boolean;
  setStyle: (key: keyof ElementStyle, value: number | string | undefined) => void;
}) {
  const isText = node.kind === "heading" || node.kind === "text" || node.kind === "button" || node.kind === "faq";
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

      {isText ? (
        <section className="builder-card">
          <h3>Type</h3>
          <NumberField label="Size" value={style.fontSize} min={10} max={96} suffix="px" overridden={overridden("fontSize")} onChange={(value) => setStyle("fontSize", value)} />
          <NumberField label="Weight" value={style.fontWeight} min={300} max={900} overridden={overridden("fontWeight")} onChange={(value) => setStyle("fontWeight", value)} />
          <NumberField label="Line height" value={style.lineHeight} min={0.9} max={3} step={0.1} overridden={overridden("lineHeight")} onChange={(value) => setStyle("lineHeight", value)} />
          <NumberField label="Letter spacing" value={style.letterSpacing} min={-2} max={12} suffix="px" overridden={overridden("letterSpacing")} onChange={(value) => setStyle("letterSpacing", value)} />
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
          <p className="hint">Try 1.5 for a landscape crop, 1 for square. Leave empty to show the whole photo.</p>
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
        {node.kind === "section" || node.kind === "column" ? (
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
        <h3>Box</h3>
        <ColourField label="Background" value={style.backgroundColor} onChange={(value) => setStyle("backgroundColor", value)} />
        <div className="builder-split">
          <NumberField label="Border" value={style.borderWidth} min={0} max={12} suffix="px" overridden={overridden("borderWidth")} onChange={(value) => setStyle("borderWidth", value)} />
          <NumberField label="Corner radius" value={style.borderRadius} min={0} max={80} suffix="px" overridden={overridden("borderRadius")} onChange={(value) => setStyle("borderRadius", value)} />
        </div>
        <ColourField label="Border colour" value={style.borderColor} onChange={(value) => setStyle("borderColor", value)} />
        <NumberField label="Maximum width" value={style.maxWidth} min={0} max={1600} suffix="px" overridden={overridden("maxWidth")} onChange={(value) => setStyle("maxWidth", value)} />
      </section>

      <p className="hint">
        {breakpoint === "desktop"
          ? "Desktop values are the base. Switch to tablet or mobile to override just that screen."
          : `Editing ${BREAKPOINT_LABELS[breakpoint].toLowerCase()} only. Clear a field to inherit the wider screen.`}
      </p>
      {isBox && node.kind === "section" && !style.backgroundColor ? (
        <p className="hint">Set a background colour to make a full-width band.</p>
      ) : null}
    </>
  );
}
