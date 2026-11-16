"use client";

import { useEffect } from "react";
import { DEFAULT_DESIGN_BANNER, DEFAULT_HERO_ACTIONS, DEFAULT_HOMEPAGE_QUESTIONS, DEFAULT_MESSAGE_STYLE, HOMEPAGE_CONTENT_FIELDS, HOMEPAGE_SECTIONS, parseHomepageLayout, type HomepageContentKey, type HomepageSectionId } from "@/lib/homepage-builder";

const titleFields = new Set<HomepageContentKey>(["heroLabel", "heroHeadlineTop", "heroHeadlineBottom", "homeProductsTitle", "homeContactTitle"]);
function displayTitle(value: string) {
  return /[A-Z]/.test(value) && value === value.toUpperCase()
    ? value.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase()) : value;
}

/** Only the authenticated preview installs this bridge; it never saves data. */
export default function HomepagePreviewBridge() {
  useEffect(() => {
    document.body.classList.add("homepage-preview-editing");
    const allowed = new Set<string>(HOMEPAGE_SECTIONS.map(section => section.id));
    let editingAllowed = false;
    let activeEditor: HTMLElement | null = null;
    let originalText = "";
    let lastPayload: { layout: unknown; selected?: unknown; editingAllowed?: unknown } | null = null;
    let lastRoot: HTMLElement | null = null;
    const visibleRoot = () => {
      const roots = Array.from(document.querySelectorAll<HTMLElement>(".kcp-home"));
      const visible = roots.filter(root => root.getClientRects().length > 0 && getComputedStyle(root).visibility !== "hidden");
      const editingRoot = activeEditor?.closest<HTMLElement>(".kcp-home");
      return editingRoot && visible.includes(editingRoot) ? editingRoot : visible.at(-1) ?? null;
    };
    const apply = (payload: { layout: unknown; selected?: unknown; editingAllowed?: unknown }) => {
      const layout = parseHomepageLayout(payload.layout);
      const root = visibleRoot();
      if (!layout || !root) return;
      lastRoot = root;
      editingAllowed = payload.editingAllowed === true;
      allowed.clear();
      for (const id of layout.sections) allowed.add(id);
      const customIds = new Set((layout.customBlocks ?? []).map(block => block.id));
      for (const old of root.querySelectorAll<HTMLElement>(":scope > [data-home-section^='custom-']")) {
        if (!customIds.has(old.dataset.homeSection as `custom-${string}`)) old.remove();
      }
      for (const block of layout.customBlocks ?? []) {
        let section = root.querySelector<HTMLElement>(`:scope > [data-home-section="${block.id}"]`);
        if (section && activeEditor && section.contains(activeEditor)) continue;
        if (block.type === "products") {
          if (!section) { section = document.createElement("section"); section.dataset.homeSection = block.id; section.className = "kcp-featured kcp-wrap kcp-custom-products"; root.append(section); }
          const headingContainer = document.createElement("div"); headingContainer.className = "kcp-heading";
          const copy = document.createElement("div"); const heading = document.createElement("h2"); heading.dataset.homeCustomField = "heading"; heading.textContent = block.heading; const description = document.createElement("p"); description.dataset.homeCustomField = "description"; description.textContent = block.description;
          copy.append(heading, description); headingContainer.append(copy);
          const grid = document.createElement("ul"); grid.className = "mm-product-grid";
          for (const id of block.productIds ?? []) {
            const product = root.querySelector<HTMLElement>(`[data-home-preview-products] [data-home-product-id="${id}"] > article`);
            if (product) { const item = document.createElement("li"); item.append(product.cloneNode(true)); grid.append(item); }
          }
          section.replaceChildren(headingContainer, grid);
          continue;
        }
        if (block.type === "faq") {
          if (!section) { section = document.createElement("section"); section.dataset.homeSection = block.id; section.className = "kcp-custom-faq kcp-wrap"; root.append(section); }
          const heading = document.createElement("h2"); heading.dataset.homeCustomField = "heading"; heading.textContent = block.heading;
          const description = document.createElement("p"); description.dataset.homeCustomField = "description"; description.textContent = block.description;
          const list = document.createElement("div"); list.className = "kcp-faq-list";
          for (const item of block.faqItems ?? []) {
            const details = document.createElement("details"); const summary = document.createElement("summary"); summary.textContent = item.question;
            const marker = document.createElement("span"); marker.setAttribute("aria-hidden", "true"); marker.textContent = "+"; summary.append(marker);
            const answer = document.createElement("p"); answer.textContent = item.answer; details.append(summary, answer); list.append(details);
          }
          section.replaceChildren(heading, description, list);
          continue;
        }
        if (!section) {
          section = document.createElement("section");
          section.className = "kcp-custom-message kcp-wrap";
          section.dataset.homeSection = block.id;
          const inner = document.createElement("div"); inner.className = "kcp-custom-message-inner";
          const copy = document.createElement("div"); copy.append(document.createElement("h2"), document.createElement("p")); inner.append(copy); section.append(inner); root.append(section);
        }
        const style = block.style ?? DEFAULT_MESSAGE_STYLE;
        section.dataset.tone = style.tone; section.dataset.alignment = style.alignment; section.dataset.imagePosition = style.imagePosition;
        const inner = section.querySelector<HTMLElement>(".kcp-custom-message-inner")!;
        const copy = inner.querySelector<HTMLElement>(":scope > div")!;
        const heading = copy.querySelector<HTMLElement>("h2")!; heading.dataset.homeCustomField = "heading"; heading.textContent = block.heading;
        const description = copy.querySelector<HTMLElement>("p")!; description.dataset.homeCustomField = "description"; description.textContent = block.description;
        let link = copy.querySelector<HTMLAnchorElement>("a");
        if (block.buttonText && block.buttonLink) {
          if (!link) { link = document.createElement("a"); link.className = "kcp-button kcp-button-dark"; copy.append(link); }
          link.textContent = block.buttonText; link.setAttribute("href", block.buttonLink);
        } else link?.remove();
        let image = inner.querySelector<HTMLImageElement>(".kcp-custom-message-image");
        if (block.image) {
          if (!image) { image = document.createElement("img"); image.className = "kcp-custom-message-image"; image.width = 1200; image.height = 900; inner.append(image); }
          if (image.dataset.homePreviewSource !== block.image) { image.removeAttribute("srcset"); image.src = block.image; image.dataset.homePreviewSource = block.image; }
          image.alt = block.imageAlt ?? "";
        } else image?.remove();
      }
      const sections = new Map(Array.from(root.querySelectorAll<HTMLElement>(":scope > [data-home-section]")).map(element => [element.dataset.homeSection, element]));
      if (!activeEditor) for (const id of layout.sections) {
        const section = sections.get(id);
        if (section) root.appendChild(section);
      }
      for (const [id, section] of sections) {
        section.toggleAttribute("data-home-selected", id === payload.selected);
        section.hidden = layout.hiddenSections?.includes(id as typeof layout.sections[number]) ?? false;
        const hiddenOn = layout.hiddenOn?.[id as HomepageSectionId] ?? [];
        if (hiddenOn.length) section.setAttribute("data-home-hide", hiddenOn.join(" "));
        else section.removeAttribute("data-home-hide");
      }
      const banner = layout.designBanner ?? DEFAULT_DESIGN_BANNER;
      for (const key of ["eyebrow", "heading", "description", "buttonText"] as const) {
        const field = root.querySelector<HTMLElement>(`[data-home-banner="${key}"]`);
        if (field && field !== activeEditor) field.textContent = banner[key];
      }
      const bannerLink = root.querySelector<HTMLAnchorElement>("[data-home-banner-link]");
      if (bannerLink) bannerLink.setAttribute("href", banner.buttonLink);
      const actions = layout.heroActions ?? DEFAULT_HERO_ACTIONS;
      for (const which of ["primary", "secondary"] as const) {
        const label = root.querySelector<HTMLElement>(`[data-home-hero-action="${which}Text"]`);
        const link = root.querySelector<HTMLAnchorElement>(`[data-home-hero-link="${which}"]`);
        if (label && label !== activeEditor) label.textContent = actions[`${which}Text`];
        if (link) link.setAttribute("href", actions[`${which}Link`]);
      }
      const questions = layout.questionsContent ?? DEFAULT_HOMEPAGE_QUESTIONS;
      for (const key of ["titleTop", "titleBottom", "introduction"] as const) {
        const field = root.querySelector<HTMLElement>(`[data-home-questions="${key}"]`);
        if (field) field.textContent = questions[key];
      }
      const questionList = root.querySelector<HTMLElement>("[data-home-questions-list]");
      if (questionList) {
        const rows = questions.items.map(item => {
          const details = document.createElement("details"); const summary = document.createElement("summary"); summary.textContent = item.question;
          const marker = document.createElement("span"); marker.setAttribute("aria-hidden", "true"); marker.textContent = "+"; summary.append(marker);
          const answer = document.createElement("p"); answer.textContent = item.answer;
          if (item.linkText && item.link) { const link = document.createElement("a"); link.href = item.link; link.textContent = item.linkText; answer.append(" ", link, "."); }
          details.append(summary, answer); return details;
        });
        questionList.replaceChildren(...rows);
      }
      if (!layout.content) return;
      for (const [key, value] of Object.entries(layout.content)) {
        const field = root.querySelector<HTMLElement>(`[data-home-field="${key}"]`);
        if (field && field !== activeEditor) field.textContent = titleFields.has(key as HomepageContentKey) ? displayTitle(value) : value;
      }
      for (let index = 1; index <= 3; index++) {
        const image = root.querySelector<HTMLImageElement>(`[data-home-hero-slide="${index}"] img`);
        if (!image) continue;
        const src = layout.content[`heroImage${index}` as "heroImage1" | "heroImage2" | "heroImage3"];
        if (image.dataset.homePreviewSource !== src) {
          image.removeAttribute("srcset");
          image.src = src;
          image.dataset.homePreviewSource = src;
        }
      }
    };
    const update = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "kcp-homepage-preview") return;
      lastPayload = event.data;
      apply(event.data);
    };
    const changes = new MutationObserver(() => {
      const root = visibleRoot();
      if (root !== lastRoot) { lastRoot = root; if (root && lastPayload) apply(lastPayload); }
    });
    changes.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "style", "class"] });
    const select = (event: MouseEvent) => {
      if (activeEditor && event.target instanceof Node && activeEditor.contains(event.target)) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-home-section]") : null;
      const id = target?.dataset.homeSection;
      if (!id || !allowed.has(id)) return;
      event.preventDefault(); event.stopPropagation();
      window.parent.postMessage({ type: "kcp-homepage-select", id }, window.location.origin);
    };
    const beginEdit = (event: MouseEvent) => {
      if (!editingAllowed || !(event.target instanceof Element)) return;
      const field = event.target.closest<HTMLElement>("[data-home-field], [data-home-banner], [data-home-custom-field], [data-home-hero-action]");
      const key = field?.dataset.homeField ?? field?.dataset.homeBanner ?? field?.dataset.homeCustomField ?? field?.dataset.homeHeroAction;
      const contentField = HOMEPAGE_CONTENT_FIELDS.find(item => item.name === key && !("image" in item));
      const customId = field?.dataset.homeCustomField ? field.closest<HTMLElement>("[data-home-section]")?.dataset.homeSection : undefined;
      if (!field || !key || (!contentField && !["eyebrow", "heading", "description", "buttonText", "primaryText", "secondaryText"].includes(key)) || (customId && !allowed.has(customId))) return;
      event.preventDefault(); event.stopPropagation();
      activeEditor = field; originalText = field.textContent ?? "";
      field.contentEditable = "true"; field.setAttribute("role", "textbox"); field.setAttribute("tabindex", "0");
      field.setAttribute("aria-label", contentField?.label ?? (customId ? "Section text" : field.dataset.homeHeroAction ? "Button text" : "Banner text"));
      window.parent.postMessage({ type: "kcp-homepage-inline-active", active: true }, window.location.origin);
      field.focus();
      const selection = window.getSelection(); const range = document.createRange();
      range.selectNodeContents(field); selection?.removeAllRanges(); selection?.addRange(range);
    };
    const finishEdit = (event: FocusEvent) => {
      if (!activeEditor || event.target !== activeEditor) return;
      const field = activeEditor; const key = field.dataset.homeField ?? field.dataset.homeBanner ?? field.dataset.homeCustomField ?? field.dataset.homeHeroAction;
      const customId = field.dataset.homeCustomField ? field.closest<HTMLElement>("[data-home-section]")?.dataset.homeSection : undefined;
      const contentField = HOMEPAGE_CONTENT_FIELDS.find(item => item.name === key && !("image" in item));
      const max = contentField?.max ?? ({ eyebrow: 80, heading: 100, description: 350, buttonText: 60, primaryText: 60, secondaryText: 60 } as Record<string, number>)[key ?? ""];
      const value = (field.textContent ?? "").slice(0, max);
      field.contentEditable = "false"; field.removeAttribute("role"); field.removeAttribute("aria-label"); field.removeAttribute("tabindex");
      field.textContent = value; activeEditor = null;
      if (key && value !== originalText) window.parent.postMessage({ type: "kcp-homepage-inline-edit", group: contentField ? "content" : customId ? "block" : field.dataset.homeHeroAction ? "heroAction" : "banner", id: customId, key, value }, window.location.origin);
      window.parent.postMessage({ type: "kcp-homepage-inline-active", active: false }, window.location.origin);
    };
    const keyEdit = (event: KeyboardEvent) => {
      if (!activeEditor || event.target !== activeEditor) return;
      if (event.key === "Escape") { activeEditor.textContent = originalText; activeEditor.blur(); }
      if (event.key === "Enter" && !["heroDescription", "homeProductsDescription", "homeContactDescription", "description"].includes(activeEditor.dataset.homeField ?? activeEditor.dataset.homeBanner ?? activeEditor.dataset.homeCustomField ?? "")) { event.preventDefault(); activeEditor.blur(); }
    };
    const pasteText = (event: ClipboardEvent) => {
      if (!activeEditor || event.target !== activeEditor) return;
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      const range = selection.getRangeAt(0); range.deleteContents();
      const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
    };
    window.addEventListener("message", update);
    document.addEventListener("click", select, true);
    document.addEventListener("dblclick", beginEdit, true);
    document.addEventListener("focusout", finishEdit, true);
    document.addEventListener("keydown", keyEdit, true);
    document.addEventListener("paste", pasteText, true);
    window.parent.postMessage({ type: "kcp-homepage-ready" }, window.location.origin);
    return () => { changes.disconnect(); document.body.classList.remove("homepage-preview-editing"); window.removeEventListener("message", update); document.removeEventListener("click", select, true); document.removeEventListener("dblclick", beginEdit, true); document.removeEventListener("focusout", finishEdit, true); document.removeEventListener("keydown", keyEdit, true); document.removeEventListener("paste", pasteText, true); };
  }, []);
  return null;
}
