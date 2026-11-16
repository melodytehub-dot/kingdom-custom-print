"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_DESIGN_BANNER, DEFAULT_HERO_ACTIONS, DEFAULT_HOMEPAGE_QUESTIONS, DEFAULT_MESSAGE_STYLE, HOMEPAGE_CONTENT_FIELDS, HOMEPAGE_SECTIONS, isSafeHomepageLink, parseHomepageLayout, type DesignBanner, type HomepageContentKey, type HomepageLayout, type HomepageMessageStyle, type HomepageSectionId } from "@/lib/homepage-builder";
import { HERO_IMAGES } from "@/lib/hero-slides";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import HomepageQuestionsFields from "./HomepageQuestionsFields";

export default function HomepageSections({ onDirtyChange, products }: { onDirtyChange: (dirty: boolean) => void; products: Product[] }) {
  const [layout, setLayout] = useState<HomepageLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState<HomepageSectionId | null>(null);
  const [dropTarget, setDropTarget] = useState<HomepageSectionId | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [initial, setInitial] = useState<string | null>(null);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [previewContainer, setPreviewContainer] = useState<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [selected, setSelected] = useState<HomepageSectionId>("hero");
  const [uploading, setUploading] = useState(false);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const previewRef = useRef<HTMLIFrameElement>(null);
  const fieldsRef = useRef<HTMLFieldSetElement>(null);
  const touchDrag = useRef<HomepageSectionId | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!previewContainer) return;
    const update = () => setPreviewWidth(previewContainer.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(previewContainer);
    return () => observer.disconnect();
  }, [previewContainer]);

  const deviceWidth = { mobile: 375, tablet: 768, desktop: 1280 }[viewport];
  const previewScale = previewWidth ? Math.min(1, previewWidth / deviceWidth) : 1;

  const loadDraft = useCallback(async () => {
    setLoading(true);
    setError("");
    setConflict("");
    try {
      const response = await fetch("/api/admin/homepage-draft", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = await response.json() as { layout: unknown; hasDraft: boolean; hasPrevious: boolean; revision: string | null };
      const valid = parseHomepageLayout(result.layout);
      if (!valid) throw new Error();
      setLayout(valid);
      setInitial(JSON.stringify(valid));
      setSaved(result.hasDraft ? JSON.stringify(valid) : null);
      setRevision(result.revision);
      setHasPrevious(result.hasPrevious);
    } catch {
      setError("Could not load the homepage draft. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void loadDraft(); });
    return () => { cancelled = true; };
  }, [loadDraft]);

  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    const tick = () => {
      const point = pointer.current;
      if (point) {
        const margin = 64;
        const speed = 14;
        if (point.y < margin) window.scrollBy(0, -speed);
        else if (point.y > window.innerHeight - margin) window.scrollBy(0, speed);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging]);

  useEffect(() => {
    const frame = previewRef.current;
    const send = () => frame?.contentWindow?.postMessage({ type: "kcp-homepage-preview", layout, selected, editingAllowed: !busy && !uploading }, window.location.origin);
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
      if (event.data?.type === "kcp-homepage-ready") send();
      if (event.data?.type === "kcp-homepage-inline-active" && typeof event.data.active === "boolean") setInlineEditing(event.data.active);
      if (event.data?.type === "kcp-homepage-select" && layout?.sections.includes(event.data.id)) {
        setSelected(event.data.id as HomepageSectionId);
        if (selected !== event.data.id) fieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (event.data?.type === "kcp-homepage-inline-edit" && !busy && !uploading && typeof event.data.value === "string") {
        const { group, key, value, id } = event.data as { group: unknown; key: unknown; value: string; id?: unknown };
        const field = HOMEPAGE_CONTENT_FIELDS.find(item => item.name === key && !("image" in item));
        if (group === "content" && field && value.length <= field.max) setLayout(current => current?.content ? { ...current, content: { ...current.content, [field.name]: value } } : current);
        const limits: Record<string, number> = { eyebrow: 80, heading: 100, description: 350, buttonText: 60 };
        if (group === "banner" && typeof key === "string" && Object.hasOwn(limits, key) && value.length <= limits[key]) setLayout(current => current ? { ...current, designBanner: { ...(current.designBanner ?? DEFAULT_DESIGN_BANNER), [key]: value } } : current);
        if (group === "heroAction" && (key === "primaryText" || key === "secondaryText") && value.length <= 60) setLayout(current => current ? { ...current, heroActions: { ...(current.heroActions ?? DEFAULT_HERO_ACTIONS), [key]: value } } : current);
        if (group === "block" && typeof id === "string" && (key === "heading" || key === "description") && value.length <= (key === "heading" ? 100 : 350)) setLayout(current => current ? { ...current, customBlocks: current.customBlocks?.map(block => block.id === id ? { ...block, [key]: value } : block) } : current);
      }
    };
    window.addEventListener("message", receive);
    send();
    return () => window.removeEventListener("message", receive);
  }, [layout, selected, viewport, previewKey, busy, uploading]);

  const dirty = Boolean(layout && initial && JSON.stringify(layout) !== (saved ?? initial));
  useEffect(() => {
    onDirtyChange(dirty || inlineEditing);
    if (!dirty && !inlineEditing) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, inlineEditing, onDirtyChange]);

  function move(from: number, to: number) {
    if (!layout || busy || from < 0 || from >= layout.sections.length || to < 0 || to >= layout.sections.length || from === to) return;
    const sections = [...layout.sections];
    const [item] = sections.splice(from, 1);
    sections.splice(to, 0, item);
    setLayout({ ...layout, sections });
    setMessage("");
  }

  function toggleSection(id: HomepageSectionId) {
    if (!layout || busy || id === "hero") return;
    const hidden = layout.hiddenSections ?? [];
    setLayout({ ...layout, hiddenSections: hidden.includes(id) ? hidden.filter(section => section !== id) : [...hidden, id] });
    setMessage("");
  }

  function addSection(type: "message" | "faq" | "products") {
    if (!layout || busy || (layout.customBlocks?.length ?? 0) >= 8) return;
    const id = `custom-${crypto.randomUUID()}` as const;
    setLayout({ ...layout, sections: [...layout.sections, id], customBlocks: [...(layout.customBlocks ?? []), { id, type, heading: "", description: "", buttonText: "", buttonLink: "", ...(type === "faq" ? { faqItems: [{ question: "", answer: "" }] } : {}), ...(type === "products" ? { productIds: [] } : {}) }] });
    setSelected(id); setMessage("");
  }

  function removeMessage(id: HomepageSectionId) {
    if (!layout || busy || !window.confirm("Remove this section from the draft?")) return;
    setLayout({ ...layout, sections: layout.sections.filter(section => section !== id), hiddenSections: (layout.hiddenSections ?? []).filter(section => section !== id), customBlocks: (layout.customBlocks ?? []).filter(block => block.id !== id) });
    setSelected("hero"); setMessage("");
  }

  function updateContent(key: HomepageContentKey, value: string) {
    if (!layout?.content || busy) return;
    setLayout({ ...layout, content: { ...layout.content, [key]: value } });
    setMessage("");
  }

  async function uploadImage(key: HomepageContentKey, file: File | undefined) {
    if (!file || !layout?.content || busy || uploading) return;
    setUploading(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.append("image", file);
      const response = await fetch("/api/admin/product-media", { method: "POST", body: form });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "The image could not be uploaded.");
      setLayout(current => current?.content ? { ...current, content: { ...current.content, [key]: data.url! } } : current);
    } catch (error) { setError(error instanceof Error ? error.message : "The image could not be uploaded."); }
    finally { setUploading(false); }
  }

  async function uploadBlockImage(id: HomepageSectionId, file: File | undefined) {
    if (!file || busy || uploading) return;
    setUploading(true); setError(""); setMessage("");
    try {
      const form = new FormData(); form.append("image", file);
      const response = await fetch("/api/admin/product-media", { method: "POST", body: form });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "The image could not be uploaded.");
      setLayout(current => current ? { ...current, customBlocks: current.customBlocks?.map(block => block.id === id ? { ...block, image: data.url! } : block) } : current);
    } catch (error) { setError(error instanceof Error ? error.message : "The image could not be uploaded."); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!layout || busy || uploading || inlineEditing) return;
    if (layout.designBanner && !isSafeHomepageLink(layout.designBanner.buttonLink)) { setError("Enter a page link beginning with /, such as /shop."); return; }
    if (layout.heroActions && (!isSafeHomepageLink(layout.heroActions.primaryLink) || !isSafeHomepageLink(layout.heroActions.secondaryLink))) { setError("Enter a page link beginning with /, such as /shop."); return; }
    if (layout.questionsContent?.items.some(item => item.link && !isSafeHomepageLink(item.link))) { setError("Enter a page link beginning with /, such as /contact."); return; }
    if (layout.customBlocks?.some(block => block.buttonLink && !isSafeHomepageLink(block.buttonLink))) { setError("Enter a page link beginning with /, such as /shop."); return; }
    setBusy(true); setError(""); setMessage(""); setConflict("");
    try {
      const response = await fetch("/api/admin/homepage-draft", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...layout, expectedRevision: revision }) });
      const data = await response.json().catch(() => ({})) as { error?: string; revision?: string };
      if (!response.ok || !data.revision) {
        if (response.status === 409) { setConflict(data.error || "This draft changed in another session. Download your changes, then reload the saved draft."); return; }
        setError(data.error || "Could not save the draft. Please try again.");
        return;
      }
      setRevision(data.revision);
      setSaved(JSON.stringify(layout));
      setPreviewKey(value => value + 1);
      setMessage("Draft saved.");
    } catch { setError("Could not save the draft. Please try again."); }
    finally { setBusy(false); }
  }

  async function changePublished(action: "publish" | "restore") {
    if (!layout || busy || uploading || inlineEditing || (action === "publish" && saved !== JSON.stringify(layout))) return;
    if (action === "restore" && !window.confirm("Restore the previous homepage? This will replace the current draft and live layout.")) return;
    setBusy(true); setError(""); setMessage(""); setConflict("");
    try {
      const response = await fetch("/api/admin/homepage-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, layout, expectedRevision: revision }) });
      const data = await response.json().catch(() => ({})) as { error?: string; layout?: unknown; hasPrevious?: boolean; revision?: string };
      if (!response.ok) {
        if (response.status === 409) { setConflict(data.error || "This draft changed in another session. Download your changes, then reload the saved draft."); return; }
        setError(data.error || "The page could not be updated.");
        return;
      }
      const next = parseHomepageLayout(data.layout);
      if (!next || !data.revision) throw new Error("The page was updated, but the editor could not refresh. Reload this page.");
      setRevision(data.revision);
      setLayout(next); setSaved(JSON.stringify(next)); setHasPrevious(Boolean(data.hasPrevious)); setPreviewKey(value => value + 1);
      router.refresh();
      setMessage(action === "publish" ? "Homepage published." : "Previous homepage restored.");
    } catch (error) { setError(error instanceof Error ? error.message : "The page could not be updated. Please try again."); }
    finally { setBusy(false); }
  }

  async function discard() {
    if (busy || uploading || inlineEditing || !window.confirm("Discard this homepage draft? Your live homepage will stay as it is.")) return;
    setBusy(true); setError(""); setMessage(""); setConflict("");
    try {
      const removed = await fetch("/api/admin/homepage-draft", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: revision }) });
      const removal = await removed.json().catch(() => ({})) as { error?: string };
      if (!removed.ok) {
        if (removed.status === 409) { setConflict(removal.error || "This draft changed in another session. Download your changes, then reload the saved draft."); return; }
        throw new Error(removal.error || "Could not discard the draft.");
      }
      await loadDraft();
      setMessage("Draft discarded.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not discard the draft. Please refresh and try again."); }
    finally { setBusy(false); }
  }

  function downloadChanges() {
    if (!layout) return;
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `homepage-changes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function reloadSavedDraft() {
    if (!window.confirm("Reload the latest saved draft? Your unsaved changes will be replaced. Download them first if you want to keep a copy.")) return;
    await loadDraft();
    setSelected("hero");
  }

  return <section className="admin-homepage-sections" aria-label="Homepage sections">
    <div className="admin-block-head"><div><h2 className="h3">Homepage editor</h2><p className="small muted">Arrange sections, edit content, and preview before publishing.</p></div></div>
    <p className="hint">Drag sections or use the arrow buttons. Select a section to edit it, or double-click editable text in the preview (double-tap on touch screens). Use Hide or Show to control which sections appear.</p>
    {conflict ? <div className="banner-note is-error admin-editor-notice" role="alert"><p><strong>Changes were not saved.</strong> {conflict}</p><div className="admin-editor-actions"><button type="button" className="btn btn-light" onClick={downloadChanges}>Download my changes</button><button type="button" className="btn btn-light" disabled={loading || busy || inlineEditing} onClick={() => void reloadSavedDraft()}>Reload saved draft</button></div></div> : error ? <div className="banner-note is-error admin-editor-notice" role="alert"><p>{error}</p>{!layout ? <div className="admin-editor-actions"><button type="button" className="btn btn-light" onClick={() => void loadDraft()}>Try again</button></div> : null}</div> : null}
    {message ? <p className="banner-note is-ok" role="status">{message}</p> : null}
    {loading ? <p role="status">Loading sections…</p> : layout ? <><ol className="admin-section-list">{layout.sections.map((id, index) => {
      const block = layout.customBlocks?.find(item => item.id === id);
      const label = HOMEPAGE_SECTIONS.find(section => section.id === id)?.label ?? (block?.heading || (block?.type === "faq" ? "Questions section" : block?.type === "products" ? "Products section" : "Message section"));
      return <li key={id} data-section-id={id} draggable={!busy} onDragStart={event => { setDragging(id); setDropTarget(null); pointer.current = null; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); }} onDrag={event => { pointer.current = { x: event.clientX, y: event.clientY }; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-section-id]")?.dataset.sectionId as HomepageSectionId | undefined; setDropTarget(target && target !== id ? target : null); }} onDragEnd={() => { setDragging(null); setDropTarget(null); pointer.current = null; }} onDragOver={event => { event.preventDefault(); setDropTarget(current => current === id ? current : id); }} onDrop={event => { event.preventDefault(); const source = event.dataTransfer.getData("text/plain"); move(layout.sections.indexOf(source as HomepageSectionId), index); setDragging(null); setDropTarget(null); pointer.current = null; }} className={[dragging === id ? "is-dragging" : "", dropTarget === id && dragging !== id ? "is-drop-target" : ""].filter(Boolean).join(" ")}>
        <span className="admin-section-handle" aria-hidden="true" onPointerDown={event => { if (event.pointerType !== "touch" || busy) return; event.currentTarget.setPointerCapture(event.pointerId); touchDrag.current = id; pointer.current = { x: event.clientX, y: event.clientY }; setDragging(id); setDropTarget(null); }} onPointerMove={event => { if (event.pointerType !== "touch" || touchDrag.current !== id) return; pointer.current = { x: event.clientX, y: event.clientY }; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-section-id]")?.dataset.sectionId as HomepageSectionId | undefined; setDropTarget(target && target !== id ? target : null); }} onPointerUp={event => { if (event.pointerType !== "touch" || touchDrag.current !== id) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-section-id]")?.dataset.sectionId; if (target) move(layout.sections.indexOf(id), layout.sections.indexOf(target as HomepageSectionId)); touchDrag.current = null; pointer.current = null; setDragging(null); setDropTarget(null); }} onPointerCancel={() => { touchDrag.current = null; pointer.current = null; setDragging(null); setDropTarget(null); }}>⋮⋮</span><button type="button" className="admin-section-label" aria-pressed={selected === id} onClick={() => setSelected(id)}>{label}</button>
        <div className="admin-section-controls">
        {id !== "hero" ? <button type="button" className="admin-section-visibility" aria-label={`${layout.hiddenSections?.includes(id) ? "Show" : "Hide"} ${label}`} disabled={busy} onClick={() => toggleSection(id)}>{layout.hiddenSections?.includes(id) ? "Show" : "Hide"}</button> : null}
        <button type="button" aria-label={`Move ${label} up`} disabled={busy || index === 0} onClick={() => move(index, index - 1)}>↑</button>
        <button type="button" aria-label={`Move ${label} down`} disabled={busy || index === layout.sections.length - 1} onClick={() => move(index, index + 1)}>↓</button>
        </div>
      </li>;
    })}</ol>
    <div className="admin-editor-actions"><button type="button" className="btn btn-light" onClick={() => addSection("message")} disabled={busy || (layout.customBlocks?.length ?? 0) >= 8}>Add message section</button><button type="button" className="btn btn-light" onClick={() => addSection("faq")} disabled={busy || (layout.customBlocks?.length ?? 0) >= 8}>Add questions section</button><button type="button" className="btn btn-light" onClick={() => addSection("products")} disabled={busy || (layout.customBlocks?.length ?? 0) >= 8}>Add products section</button></div>
    <fieldset ref={fieldsRef} className="fieldset admin-section-fields"><legend className="label">Edit {HOMEPAGE_SECTIONS.find(section => section.id === selected)?.label ?? (layout.customBlocks?.find(block => block.id === selected)?.type === "faq" ? "questions section" : layout.customBlocks?.find(block => block.id === selected)?.type === "products" ? "products section" : "message section")}</legend>
      {selected === "questions" ? <HomepageQuestionsFields value={layout.questionsContent ?? DEFAULT_HOMEPAGE_QUESTIONS} disabled={busy} onChange={questionsContent => setLayout({ ...layout, questionsContent })} /> : selected === "hero-actions" ? <>{([ ["primaryText", "First button text", 60], ["primaryLink", "First button link", 300], ["secondaryText", "Second button text", 60], ["secondaryLink", "Second button link", 300] ] as const).map(([key, label, max]) => <div className="field" key={key}><label className="label" htmlFor={`hero-action-${key}`}>{label}</label><input id={`hero-action-${key}`} className="input" maxLength={max} disabled={busy} value={(layout.heroActions ?? DEFAULT_HERO_ACTIONS)[key]} onChange={event => setLayout({ ...layout, heroActions: { ...(layout.heroActions ?? DEFAULT_HERO_ACTIONS), [key]: event.target.value } })} />{key.endsWith("Link") ? <span className="hint">Use a page on your website, such as /shop or /contact.</span> : null}</div>)}</> : layout.customBlocks?.find(block => block.id === selected)?.type === "products" ? (() => {
        const block = layout.customBlocks!.find(item => item.id === selected)!;
        const update = (patch: Partial<typeof block>) => setLayout({ ...layout, customBlocks: layout.customBlocks!.map(item => item.id === selected ? { ...item, ...patch } : item) });
        const active = products.filter(product => product.active);
        const matches = active.filter(product => `${product.name} ${product.styleCode}`.toLowerCase().includes(productSearch.trim().toLowerCase()));
        return <><div className="field"><label className="label" htmlFor="product-section-heading">Heading</label><input id="product-section-heading" className="input" maxLength={100} value={block.heading} disabled={busy} onChange={event => update({ heading: event.target.value })} /></div><div className="field"><label className="label" htmlFor="product-section-description">Description</label><textarea id="product-section-description" className="textarea" maxLength={350} value={block.description} disabled={busy} onChange={event => update({ description: event.target.value })} /></div><p className="hint">Choose up to eight active products. They appear in the order selected.</p><label className="label" htmlFor="homepage-product-search">Find products</label><input id="homepage-product-search" className="input" type="search" value={productSearch} onChange={event => setProductSearch(event.target.value)} /><div className="admin-product-picks">{matches.length ? matches.map(product => <label key={product.id}><input type="checkbox" checked={block.productIds?.includes(product.id) ?? false} disabled={busy || (!block.productIds?.includes(product.id) && (block.productIds?.length ?? 0) >= 8)} onChange={event => update({ productIds: event.target.checked ? [...(block.productIds ?? []), product.id] : (block.productIds ?? []).filter(id => id !== product.id) })} /><span>{product.name}</span></label>) : <p>{active.length ? "No products match your search." : "No active products are available."}</p>}</div>{block.productIds?.some(id => !active.some(product => product.id === id)) ? <div className="banner-note is-error"><p>Some selected products are no longer active.</p><button type="button" disabled={busy} onClick={() => update({ productIds: (block.productIds ?? []).filter(id => active.some(product => product.id === id)) })}>Remove unavailable products</button></div> : null}<button type="button" className="btn btn-light" disabled={busy} onClick={() => removeMessage(selected)}>Remove section</button></>;
      })() : layout.customBlocks?.find(block => block.id === selected)?.type === "faq" ? (() => {
        const block = layout.customBlocks!.find(item => item.id === selected)!;
        const update = (patch: Partial<typeof block>) => setLayout({ ...layout, customBlocks: layout.customBlocks!.map(item => item.id === selected ? { ...item, ...patch } : item) });
        return <><div className="field"><label className="label" htmlFor="faq-heading">Heading</label><input id="faq-heading" className="input" maxLength={100} value={block.heading} disabled={busy} onChange={event => update({ heading: event.target.value })} /></div><div className="field"><label className="label" htmlFor="faq-description">Introduction</label><textarea id="faq-description" className="textarea" maxLength={350} value={block.description} disabled={busy} onChange={event => update({ description: event.target.value })} /></div>{(block.faqItems ?? []).map((item, index) => <div className="admin-faq-item" key={index}><label className="label" htmlFor={`faq-question-${index}`}>Question {index + 1}</label><input id={`faq-question-${index}`} className="input" maxLength={160} value={item.question} disabled={busy} onChange={event => update({ faqItems: block.faqItems!.map((entry, i) => i === index ? { ...entry, question: event.target.value } : entry) })} /><label className="label" htmlFor={`faq-answer-${index}`}>Answer {index + 1}</label><textarea id={`faq-answer-${index}`} className="textarea" maxLength={600} value={item.answer} disabled={busy} onChange={event => update({ faqItems: block.faqItems!.map((entry, i) => i === index ? { ...entry, answer: event.target.value } : entry) })} /><button type="button" className="btn btn-light" disabled={busy} onClick={() => update({ faqItems: block.faqItems!.filter((_, i) => i !== index) })}>Remove question {index + 1}</button></div>)}<div className="admin-editor-actions"><button type="button" className="btn btn-light" disabled={busy || (block.faqItems?.length ?? 0) >= 6} onClick={() => update({ faqItems: [...(block.faqItems ?? []), { question: "", answer: "" }] })}>Add question</button><button type="button" className="btn btn-light" disabled={busy} onClick={() => removeMessage(selected)}>Remove section</button></div></>;
      })() : layout.customBlocks?.some(block => block.id === selected) ? <>{([ ["heading", "Heading", 100], ["description", "Description", 350], ["buttonText", "Button text", 60], ["buttonLink", "Button link", 300] ] as const).map(([key, label, max]) => {
        const block = layout.customBlocks!.find(item => item.id === selected)!;
        const change = (value: string) => setLayout({ ...layout, customBlocks: layout.customBlocks!.map(item => item.id === selected ? { ...item, [key]: value } : item) });
        return <div className="field" key={key}><label className="label" htmlFor={`message-${key}`}>{label}</label>{key === "description" ? <textarea id={`message-${key}`} className="textarea" maxLength={max} disabled={busy} value={block[key]} onChange={event => change(event.target.value)} /> : <input id={`message-${key}`} className="input" maxLength={max} disabled={busy} value={block[key]} onChange={event => change(event.target.value)} />}{key === "buttonLink" ? <span className="hint">Optional. Use a page on your website, such as /shop.</span> : null}</div>;
      })}<div className="field"><label className="label" htmlFor="message-tone">Background</label><select id="message-tone" className="select" disabled={busy} value={layout.customBlocks.find(block => block.id === selected)?.style?.tone ?? DEFAULT_MESSAGE_STYLE.tone} onChange={event => setLayout({ ...layout, customBlocks: layout.customBlocks!.map(block => block.id === selected ? { ...block, style: { ...(block.style ?? DEFAULT_MESSAGE_STYLE), tone: event.target.value as HomepageMessageStyle["tone"] } } : block) })}><option value="rose">Soft rose</option><option value="ivory">Ivory</option><option value="dark">Dark</option></select></div><div className="field"><label className="label" htmlFor="message-alignment">Text alignment</label><select id="message-alignment" className="select" disabled={busy} value={layout.customBlocks.find(block => block.id === selected)?.style?.alignment ?? DEFAULT_MESSAGE_STYLE.alignment} onChange={event => setLayout({ ...layout, customBlocks: layout.customBlocks!.map(block => block.id === selected ? { ...block, style: { ...(block.style ?? DEFAULT_MESSAGE_STYLE), alignment: event.target.value as HomepageMessageStyle["alignment"] } } : block) })}><option value="left">Left</option><option value="center">Center</option></select></div><div className="field"><label className="label" htmlFor="message-position">Image position</label><select id="message-position" className="select" disabled={busy} value={layout.customBlocks.find(block => block.id === selected)?.style?.imagePosition ?? DEFAULT_MESSAGE_STYLE.imagePosition} onChange={event => setLayout({ ...layout, customBlocks: layout.customBlocks!.map(block => block.id === selected ? { ...block, style: { ...(block.style ?? DEFAULT_MESSAGE_STYLE), imagePosition: event.target.value as HomepageMessageStyle["imagePosition"] } } : block) })}><option value="left">Before text</option><option value="right">After text</option></select></div><div className="field"><label className="label" htmlFor="message-image">Section image</label><input id="message-image" className="admin-image-upload" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || uploading} onChange={event => { void uploadBlockImage(selected, event.target.files?.[0]); event.currentTarget.value = ""; }} /><span className="hint">Optional. JPG, PNG or WebP, up to 4 MB.</span>{layout.customBlocks.find(block => block.id === selected)?.image ? <><label className="label" htmlFor="message-image-alt">Image description</label><input id="message-image-alt" className="input" maxLength={160} value={layout.customBlocks.find(block => block.id === selected)?.imageAlt ?? ""} onChange={event => setLayout({ ...layout, customBlocks: layout.customBlocks!.map(block => block.id === selected ? { ...block, imageAlt: event.target.value } : block) })} /><span className="hint">Describe the image for people who cannot see it; leave blank if it is decorative.</span><button type="button" className="btn btn-light" onClick={() => setLayout({ ...layout, customBlocks: layout.customBlocks!.map(block => block.id === selected ? { ...block, image: "", imageAlt: "" } : block) })}>Remove image</button></> : null}</div><button type="button" className="btn btn-light" onClick={() => removeMessage(selected)} disabled={busy || uploading}>Remove section</button></> : selected === "design-banner" ? <>{([
        ["eyebrow", "Small heading", 80], ["heading", "Heading", 100], ["description", "Description", 350], ["buttonText", "Button text", 60], ["buttonLink", "Button link", 300],
      ] as const).map(([key, label, max]) => <div className="field" key={key}><label className="label" htmlFor={`banner-${key}`}>{label}</label>{key === "description" ? <textarea id={`banner-${key}`} className="textarea" maxLength={max} disabled={busy} value={(layout.designBanner ?? DEFAULT_DESIGN_BANNER)[key]} onChange={event => setLayout({ ...layout, designBanner: { ...(layout.designBanner ?? DEFAULT_DESIGN_BANNER), [key]: event.target.value } })} /> : <input id={`banner-${key}`} className="input" maxLength={max} disabled={busy} value={(layout.designBanner ?? DEFAULT_DESIGN_BANNER)[key as keyof DesignBanner]} onChange={event => setLayout({ ...layout, designBanner: { ...(layout.designBanner ?? DEFAULT_DESIGN_BANNER), [key]: event.target.value } })} />}{key === "buttonLink" ? <span className="hint">Use a page on your website, such as /shop or /contact.</span> : null}</div>)}</> : HOMEPAGE_CONTENT_FIELDS.filter(field => field.section === selected).length ? HOMEPAGE_CONTENT_FIELDS.filter(field => field.section === selected).map(field => <div className="field" key={field.name}>
        <label className="label" htmlFor={`homepage-${field.name}`}>{field.label}</label>
        {"image" in field ? <><select id={`homepage-${field.name}`} className="select" value={layout.content?.[field.name] ?? ""} disabled={busy || uploading} onChange={event => updateContent(field.name, event.target.value)}>{HERO_IMAGES.map(image => <option value={image.src} key={image.src}>{image.name}</option>)}{layout.content?.[field.name] && !HERO_IMAGES.some(image => image.src === layout.content?.[field.name]) ? <option value={layout.content[field.name]}>Uploaded photo</option> : null}</select><input className="admin-image-upload" type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Upload ${field.label}`} disabled={busy || uploading} onChange={event => { void uploadImage(field.name, event.target.files?.[0]); event.currentTarget.value = ""; }} /><span className="hint">JPG, PNG or WebP, up to 4 MB.</span></> : "multiline" in field ? <textarea id={`homepage-${field.name}`} className="textarea" maxLength={field.max} value={layout.content?.[field.name] ?? ""} disabled={busy} onChange={event => updateContent(field.name, event.target.value)} /> : <input id={`homepage-${field.name}`} className="input" maxLength={field.max} value={layout.content?.[field.name] ?? ""} disabled={busy} onChange={event => updateContent(field.name, event.target.value)} />}
      </div>) : <p className="hint">This section can be moved using the list above.</p>}
      {uploading ? <p role="status">Uploading image…</p> : null}
    </fieldset>
    <div className="admin-editor-actions"><button type="button" className="btn" onClick={save} disabled={busy || uploading || inlineEditing}>{busy ? "Please wait…" : "Save draft"}</button><button type="button" className="btn btn-light" onClick={() => changePublished("publish")} disabled={busy || uploading || inlineEditing || saved !== JSON.stringify(layout)}>Publish</button><button type="button" className="btn btn-light" onClick={discard} disabled={busy || uploading || inlineEditing || (!saved && !dirty)}>Discard draft</button><button type="button" className="btn btn-light" onClick={() => changePublished("restore")} disabled={busy || uploading || inlineEditing || !hasPrevious}>Restore previous</button></div>
    {inlineEditing ? <p className="hint">Finish editing the text in the preview before saving.</p> : null}
    {saved !== JSON.stringify(layout) ? <p className="hint">Save your draft before publishing.</p> : null}
    <div className="admin-editor-preview"><h3>Draft preview</h3><div className="admin-preview-toolbar" role="group" aria-label="Draft preview screen size">{(["mobile", "tablet", "desktop"] as const).map(size => <button type="button" key={size} aria-pressed={viewport === size} onClick={() => setViewport(size)}>{size[0].toUpperCase() + size.slice(1)}</button>)}</div><div className="admin-preview-scroll"><div ref={setPreviewContainer} className="admin-preview-fit"><div className="admin-preview-frame" style={{ width: deviceWidth * previewScale, height: 800 * previewScale }}><iframe ref={previewRef} key={previewKey} title={`${viewport} homepage draft preview`} src="/homepage-preview" style={{ width: deviceWidth, transform: `scale(${previewScale})` }} /></div></div></div></div></> : null}
  </section>;
}
