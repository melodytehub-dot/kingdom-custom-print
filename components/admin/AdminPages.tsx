"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PAGE_LIMITS,
  isPageSlug,
  isSafePageLink,
  newPageBlock,
  pageSlugFromTitle,
  parseCustomPages,
  type CustomPage,
  type PageBlock,
  type PageBlockType,
} from "@/lib/custom-pages";

const BLOCK_LABELS: Record<PageBlockType, string> = {
  heading: "Heading",
  paragraph: "Paragraph",
  image: "Image",
  button: "Button",
  faq: "Questions and answers",
};

function newPage(): CustomPage {
  return {
    id: crypto.randomUUID(),
    slug: "",
    title: "",
    description: "",
    blocks: [newPageBlock("paragraph")],
    published: false,
    updatedAt: new Date().toISOString(),
  };
}

export default function AdminPages() {
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [draft, setDraft] = useState<CustomPage | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/pages", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as { pages?: unknown };
      setPages(parseCustomPages(data.pages));
    } catch {
      setError("Could not load your pages. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [load]);

  function startNew() {
    setDraft(newPage());
    setSlugEdited(false);
    setError("");
    setMessage("");
  }

  function edit(page: CustomPage) {
    setDraft({ ...page, blocks: page.blocks.map(block => ({ ...block })) });
    setSlugEdited(true);
    setError("");
    setMessage("");
  }

  function update(patch: Partial<CustomPage>) {
    setDraft(current => current ? { ...current, ...patch } : current);
  }

  function updateBlock(id: string, patch: Partial<PageBlock>) {
    setDraft(current => current ? { ...current, blocks: current.blocks.map(block => block.id === id ? { ...block, ...patch } as PageBlock : block) } : current);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setDraft(current => {
      if (!current) return current;
      const target = index + direction;
      if (target < 0 || target >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      const [item] = blocks.splice(index, 1);
      blocks.splice(target, 0, item);
      return { ...current, blocks };
    });
  }

  function removeBlock(id: string) {
    setDraft(current => current ? { ...current, blocks: current.blocks.filter(block => block.id !== id) } : current);
  }

  async function uploadImage(id: string, file: File | undefined) {
    if (!file || uploading || busy) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/admin/product-media", { method: "POST", body: form });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "The image could not be uploaded.");
      updateBlock(id, { src: data.url } as Partial<PageBlock>);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The image could not be uploaded.");
    } finally {
      setUploading(false);
    }
  }

  function validate(page: CustomPage): string {
    if (!page.title.trim()) return "Add a page title.";
    if (!isPageSlug(page.slug)) return "Choose a page address using lowercase letters, numbers and dashes. It cannot match an existing page on the site.";
    if (page.blocks.some(block => block.type === "button" && (!block.text.trim() || !isSafePageLink(block.href)))) return "Each button needs text and a link that begins with /, such as /shop.";
    if (page.blocks.some(block => block.type === "faq" && block.items.some(item => !item.question.trim() || !item.answer.trim()))) return "Complete each question and answer.";
    return "";
  }

  async function save() {
    if (!draft || busy || uploading) return;
    const problem = validate(draft);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", page: { ...draft, updatedAt: new Date().toISOString() } }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; pages?: unknown };
      if (!response.ok) throw new Error(data.error || "The page could not be saved.");
      setPages(parseCustomPages(data.pages));
      setDraft(null);
      setMessage("Page saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The page could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(page: CustomPage) {
    if (busy || !window.confirm(`Delete “${page.title}”? This removes the page from your website.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: page.id }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; pages?: unknown };
      if (!response.ok) throw new Error(data.error || "The page could not be deleted.");
      setPages(parseCustomPages(data.pages));
      if (draft?.id === page.id) setDraft(null);
      setMessage("Page deleted.");
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "The page could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  if (draft) {
    return <section className="admin-pages" aria-label="Page editor">
      <div className="admin-block-head"><div><h2 className="h3">{pages.some(page => page.id === draft.id) ? "Edit page" : "New page"}</h2><p className="small muted">Pages appear at the address you choose, for example /size-guide.</p></div></div>
      {error ? <p className="banner-note is-error" role="alert">{error}</p> : null}
      <div className="admin-page-form">
        <div className="field">
          <label className="label" htmlFor="page-title">Title</label>
          <input id="page-title" className="input" maxLength={PAGE_LIMITS.title} value={draft.title} onChange={event => {
            const title = event.target.value;
            update({ title, ...(slugEdited ? {} : { slug: pageSlugFromTitle(title) }) });
          }} />
        </div>
        <div className="field">
          <label className="label" htmlFor="page-slug">Page address</label>
          <div className="admin-slug-input">
            <span aria-hidden="true">/</span>
            <input id="page-slug" className="input" maxLength={60} value={draft.slug} onChange={event => { setSlugEdited(true); update({ slug: event.target.value.toLowerCase() }); }} />
          </div>
          <span className="hint">Lowercase letters, numbers and dashes. Existing pages cannot be replaced.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="page-description">Introduction</label>
          <textarea id="page-description" className="textarea" rows={3} maxLength={PAGE_LIMITS.description} value={draft.description} onChange={event => update({ description: event.target.value })} />
          <span className="hint">Shown under the title and used as the search description.</span>
        </div>
        <label className="admin-check"><input type="checkbox" checked={draft.published} onChange={event => update({ published: event.target.checked })} /><span>Publish this page on the website</span></label>

        <h3 className="h4 admin-page-blocks-title">Content</h3>
        {draft.blocks.length ? <ol className="admin-page-blocks">{draft.blocks.map((block, index) => <li key={block.id} className="admin-page-block">
          <div className="admin-page-block-head">
            <strong>{BLOCK_LABELS[block.type]}</strong>
            <div className="admin-section-controls">
              <button type="button" aria-label={`Move ${BLOCK_LABELS[block.type]} up`} disabled={busy || index === 0} onClick={() => moveBlock(index, -1)}>↑</button>
              <button type="button" aria-label={`Move ${BLOCK_LABELS[block.type]} down`} disabled={busy || index === draft.blocks.length - 1} onClick={() => moveBlock(index, 1)}>↓</button>
              <button type="button" aria-label={`Remove ${BLOCK_LABELS[block.type]}`} disabled={busy} onClick={() => removeBlock(block.id)}>Remove</button>
            </div>
          </div>
          {block.type === "heading" ? <>
            <label className="label" htmlFor={`block-heading-${block.id}`}>Heading text</label>
            <input id={`block-heading-${block.id}`} className="input" maxLength={PAGE_LIMITS.heading} value={block.text} disabled={busy} onChange={event => updateBlock(block.id, { text: event.target.value })} />
          </> : null}
          {block.type === "paragraph" ? <>
            <label className="label" htmlFor={`block-text-${block.id}`}>Text</label>
            <textarea id={`block-text-${block.id}`} className="textarea" rows={5} maxLength={PAGE_LIMITS.paragraph} value={block.text} disabled={busy} onChange={event => updateBlock(block.id, { text: event.target.value })} />
          </> : null}
          {block.type === "image" ? <>
            <label className="label" htmlFor={`block-image-${block.id}`}>Image address</label>
            <input id={`block-image-${block.id}`} className="input" value={block.src} disabled={busy} onChange={event => updateBlock(block.id, { src: event.target.value })} placeholder="/api/product-media/…" />
            <input className="admin-image-upload" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload an image for this block" disabled={busy || uploading} onChange={event => { void uploadImage(block.id, event.target.files?.[0]); event.currentTarget.value = ""; }} />
            <span className="hint">JPG, PNG or WebP, up to 15 MB.</span>
            <label className="label" htmlFor={`block-alt-${block.id}`}>Image description</label>
            <input id={`block-alt-${block.id}`} className="input" maxLength={PAGE_LIMITS.alt} value={block.alt} disabled={busy} onChange={event => updateBlock(block.id, { alt: event.target.value })} />
            <span className="hint">Describe the image for screen readers.</span>
          </> : null}
          {block.type === "button" ? <>
            <label className="label" htmlFor={`block-button-${block.id}`}>Button text</label>
            <input id={`block-button-${block.id}`} className="input" maxLength={PAGE_LIMITS.buttonText} value={block.text} disabled={busy} onChange={event => updateBlock(block.id, { text: event.target.value })} />
            <label className="label" htmlFor={`block-link-${block.id}`}>Button link</label>
            <input id={`block-link-${block.id}`} className="input" maxLength={300} value={block.href} disabled={busy} onChange={event => updateBlock(block.id, { href: event.target.value })} placeholder="/shop" />
          </> : null}
          {block.type === "faq" ? block.items.map((item, itemIndex) => <div key={itemIndex} className="admin-faq-item">
            <label className="label" htmlFor={`block-q-${block.id}-${itemIndex}`}>Question {itemIndex + 1}</label>
            <input id={`block-q-${block.id}-${itemIndex}`} className="input" maxLength={PAGE_LIMITS.question} value={item.question} disabled={busy} onChange={event => updateBlock(block.id, { items: block.items.map((entry, index) => index === itemIndex ? { ...entry, question: event.target.value } : entry) })} />
            <label className="label" htmlFor={`block-a-${block.id}-${itemIndex}`}>Answer {itemIndex + 1}</label>
            <textarea id={`block-a-${block.id}-${itemIndex}`} className="textarea" rows={3} maxLength={PAGE_LIMITS.answer} value={item.answer} disabled={busy} onChange={event => updateBlock(block.id, { items: block.items.map((entry, index) => index === itemIndex ? { ...entry, answer: event.target.value } : entry) })} />
            <button type="button" className="btn btn-light" disabled={busy} onClick={() => updateBlock(block.id, { items: block.items.filter((_, index) => index !== itemIndex) })}>Remove question {itemIndex + 1}</button>
          </div>) : null}
          {block.type === "faq" ? <button type="button" className="btn btn-light" disabled={busy || block.items.length >= PAGE_LIMITS.faqItems} onClick={() => updateBlock(block.id, { items: [...block.items, { question: "", answer: "" }] })}>Add question</button> : null}
        </li>)}</ol> : <p className="hint">Add a heading, text, image or button to build the page.</p>}

        <div className="admin-editor-actions">
          {(["heading", "paragraph", "image", "button", "faq"] as PageBlockType[]).map(type => <button key={type} type="button" className="btn btn-light" disabled={busy || draft.blocks.length >= PAGE_LIMITS.blocks} onClick={() => update({ blocks: [...draft.blocks, newPageBlock(type)] })}>Add {BLOCK_LABELS[type].toLowerCase()}</button>)}
        </div>

        {uploading ? <p role="status">Uploading image…</p> : null}
        <div className="admin-editor-actions">
          <button type="button" className="btn" onClick={() => void save()} disabled={busy || uploading}>{busy ? "Please wait…" : "Save page"}</button>
          <button type="button" className="btn btn-light" onClick={() => { setDraft(null); setError(""); }} disabled={busy || uploading}>Cancel</button>
        </div>
        {draft.published ? <p className="hint">After saving, this page is live at /{draft.slug}.</p> : <p className="hint">This page stays private until you publish it.</p>}
      </div>
    </section>;
  }

  return <section className="admin-pages" aria-label="Pages">
    <div className="admin-block-head"><div><h2 className="h3">Pages</h2><p className="small muted">Create extra pages for your website, such as a size guide or a company story.</p></div><button type="button" className="btn" onClick={startNew} disabled={busy || pages.length >= PAGE_LIMITS.pages}>New page</button></div>
    {error ? <p className="banner-note is-error" role="alert">{error}</p> : null}
    {message ? <p className="banner-note is-ok" role="status">{message}</p> : null}
    {loading ? <p role="status">Loading pages…</p> : pages.length ? <ul className="admin-page-list">
      {pages.map(page => <li key={page.id}>
        <div>
          <strong>{page.title}</strong>
          <span className="small muted">/{page.slug}</span>
        </div>
        <span className={`admin-page-state${page.published ? " is-live" : ""}`}>{page.published ? "Published" : "Draft"}</span>
        <div className="admin-section-controls">
          {page.published ? <a className="btn btn-light" href={`/${page.slug}`} target="_blank" rel="noreferrer">View</a> : null}
          <button type="button" className="btn btn-light" disabled={busy} onClick={() => edit(page)}>Edit</button>
          <button type="button" className="btn btn-light" disabled={busy} onClick={() => void remove(page)}>Delete</button>
        </div>
      </li>)}
    </ul> : <p className="hint">No extra pages yet. Create one for opening hours, sizing, or your story.</p>}
  </section>;
}
