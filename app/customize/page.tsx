"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import GarmentSVG from "../components/GarmentSVG";
import { PRODUCTS, getProduct, type SizeKey } from "../lib/products";
import { priceFor, formatUSD } from "../lib/pricing";
import { useStore, type DesignLayer } from "../lib/store";

const FONTS = ["Archivo Black, Arial", "Georgia, serif", "Arial Black, Arial", "Courier New, monospace", "Impact, Arial", "Trebuchet MS, Arial", "Verdana, Arial", "Times New Roman, serif", "Comic Sans MS, cursive", "Palatino, serif", "Lucida Console, monospace", "Helvetica, Arial"];
const CLIPART: { name: string; svg: string }[] = [
  { name: "Crown", svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 70'><path d='M8 55 L15 20 L32 38 L50 8 L68 38 L85 20 L92 55 Z' fill='#141414'/><rect x='8' y='55' width='84' height='8' fill='#c8102e'/></svg>` },
  { name: "Star", svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 5 L61 38 L96 38 L68 59 L78 93 L50 72 L22 93 L32 59 L4 38 L39 38 Z' fill='#141414'/></svg>` },
  { name: "Bolt", svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M58 4 L18 58 L44 58 L38 96 L82 40 L54 40 Z' fill='#141414'/></svg>` },
  { name: "Heart", svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 88 C10 60 8 30 28 20 C40 15 50 24 50 34 C50 24 60 15 72 20 C92 30 90 60 50 88Z' fill='#141414'/></svg>` },
  { name: "Badge", svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><circle cx='60' cy='60' r='52' fill='none' stroke='#141414' stroke-width='8'/><text x='60' y='74' text-anchor='middle' font-family='Arial' font-weight='900' font-size='34' fill='#141414'>EST</text></svg>` },
  { name: "Wings", svg: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 60'><path d='M5 50 Q40 5 60 30 Q80 5 115 50 Q80 40 60 48 Q40 40 5 50Z' fill='#141414'/></svg>` }
];
function svgURL(svg: string) { return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`; }
const uid = () => Math.random().toString(36).slice(2, 9);
const PRINT_AREA = { x: 160, y: 170, w: 200, h: 260 };

function StudioInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { addToCart } = useStore();
  const [productSlug, setProductSlug] = useState(sp.get("product") ?? PRODUCTS[0].slug);
  const product = useMemo(() => getProduct(productSlug), [productSlug]);
  const [colorId, setColorId] = useState(sp.get("color") ?? product.colors[0].id);
  const color = product.colors.find((c) => c.id === colorId) ?? product.colors[0];
  const [side, setSide] = useState<"front" | "back">("front");
  const [layersBySide, setLayersBySide] = useState<Record<"front" | "back", DesignLayer[]>>({ front: [], back: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"products" | "text" | "upload" | "art" | "layers">("text");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState("YOUR TEXT");
  const [font, setFont] = useState(FONTS[0]);
  const [textColor, setTextColor] = useState("#ffffff");
  const [qtyMap, setQtyMap] = useState<Record<string, number>>(() => ({ [sp.get("size") ?? "M"]: Number(sp.get("qty") ?? 1) }));
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const layers = layersBySide[side];
  const selected = layers.find((l) => l.id === selectedId) ?? null;
  const sidesUsed = (layersBySide.front.length > 0 ? 1 : 0) + (layersBySide.back.length > 0 ? 1 : 0);
  const lines = useMemo(() => Object.entries(qtyMap).filter(([, q]) => q > 0).map(([size, qty]) => ({ size, qty })), [qtyMap]);
  const price = priceFor(product, sidesUsed, lines.length ? lines as { size: SizeKey; qty: number }[] : [{ size: "M", qty: 1 }]);

  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f6f4ef"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color.hex;
    ctx.strokeStyle = "#00000022"; ctx.lineWidth = 2;
    ctx.beginPath();
    if (product.kind === "cap") { ctx.ellipse(W / 2, H / 2, 150, 110, 0, 0, Math.PI * 2); }
    else if (product.kind === "mug") { ctx.fillRect(W / 2 - 90, 120, 180, 300); }
    else { ctx.fillRect(110, 60, 300, 480); }
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.setLineDash([8, 6]); ctx.strokeStyle = "#14141455"; ctx.lineWidth = 1.5;
    ctx.strokeRect(PRINT_AREA.x, PRINT_AREA.y, PRINT_AREA.w, PRINT_AREA.h);
    ctx.setLineDash([]);
    ctx.fillStyle = "#14141466"; ctx.font = "12px Arial";
    ctx.fillText(side === "front" ? "FRONT · printable area" : "BACK · printable area", PRINT_AREA.x + 8, PRINT_AREA.y - 8);
    ctx.restore();
    layers.forEach((l) => {
      ctx.save();
      ctx.translate(l.x, l.y); ctx.rotate((l.rotation * Math.PI) / 180); ctx.scale(l.scale, l.scale);
      if (l.type === "text") {
        const size = (l.size ?? 42);
        ctx.font = `900 ${size}px ${l.font ?? FONTS[0]}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (l.outline) { ctx.lineWidth = 5; ctx.strokeStyle = l.outline; ctx.strokeText(l.text ?? "", 0, 0); }
        ctx.fillStyle = l.color ?? "#fff"; ctx.fillText(l.text ?? "", 0, 0);
      } else if (l.src) {
        const img = imgCache.current.get(l.src);
        if (img && img.complete && img.naturalWidth) {
          const s = 150 / Math.max(img.naturalWidth, img.naturalHeight);
          ctx.drawImage(img, (-img.naturalWidth * s) / 2, (-img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
        }
      }
      ctx.restore();
      if (l.id === selectedId) {
        ctx.save(); ctx.strokeStyle = "#e8721c"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.strokeRect(l.x - 70 * l.scale, l.y - 45 * l.scale, 140 * l.scale, 90 * l.scale);
        ctx.restore();
      }
    });
  }, [layers, color, product, side, selectedId]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    layersBySide.front.concat(layersBySide.back).forEach((l) => {
      if (l.src && !imgCache.current.has(l.src)) {
        const im = new Image(); im.src = l.src; imgCache.current.set(l.src, im); im.onload = () => draw();
      }
    });
  }, [layersBySide, draw]);

  function updateLayer(id: string, patch: Partial<DesignLayer>) {
    setLayersBySide((s) => ({ ...s, [side]: s[side].map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }
  function addTextLayer() {
    if (!text.trim()) { setNotice("Type some text first."); return; }
    const l: DesignLayer = { id: uid(), type: "text", x: PRINT_AREA.x + PRINT_AREA.w / 2, y: PRINT_AREA.y + 90 + layers.length * 24, scale: 1, rotation: 0, text: text.toUpperCase().slice(0, 40), font, size: 42, color: textColor, outline: textColor === "#ffffff" ? "#141414" : undefined };
    setLayersBySide((s) => ({ ...s, [side]: [...s[side], l] })); setSelectedId(l.id); setNotice(null);
  }
  function addImageLayer(src: string, name: string) {
    const l: DesignLayer = { id: uid(), type: "image", x: PRINT_AREA.x + PRINT_AREA.w / 2, y: PRINT_AREA.y + PRINT_AREA.h / 2, scale: 1, rotation: 0, src, name };
    setLayersBySide((s) => ({ ...s, [side]: [...s[side], l] })); setSelectedId(l.id);
  }
  function onUpload(file: File | undefined) {
    if (!file) return;
    if (!/image\/(png|jpeg|svg\+xml|webp)/.test(file.type)) { setNotice("Please upload a PNG, JPG, SVG or WebP file."); return; }
    if (file.size > 15 * 1024 * 1024) { setNotice("That file is over 15MB. Please use a smaller file."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const im = new Image();
      im.onload = () => {
        const max = 1200; const sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        if (sc < 1) {
          const off = document.createElement("canvas");
          off.width = im.naturalWidth * sc; off.height = im.naturalHeight * sc;
          off.getContext("2d")?.drawImage(im, 0, 0, off.width, off.height);
          addImageLayer(off.toDataURL("image/png"), file.name);
        } else addImageLayer(src, file.name);
        if (Math.min(im.naturalWidth, im.naturalHeight) < 600) setNotice("Heads up: this image is low resolution and may print soft at large sizes.");
      };
      im.src = src;
    };
    reader.readAsDataURL(file);
  }
  function toPreview(target: "front" | "back"): string {
    const cv = document.createElement("canvas"); cv.width = 520; cv.height = 620;
    const src = canvasRef.current;
    if (side !== target) {
      const keep = side; setSide(target);
      requestAnimationFrame(() => {});
      void keep;
    }
    if (src) cv.getContext("2d")?.drawImage(src, 0, 0);
    return cv.toDataURL("image/png");
  }
  function pos(e: React.PointerEvent): { x: number; y: number } {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * 520, y: ((e.clientY - rect.top) / rect.height) * 620 };
  }
  function hitTest(x: number, y: number): string | null {
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (Math.abs(x - l.x) < 80 * l.scale && Math.abs(y - l.y) < 55 * l.scale) return l.id;
    }
    return null;
  }

  function saveDesign() {
    setSaving(true);
    try {
      const all = JSON.parse(localStorage.getItem("kcp-designs") ?? "[]");
      all.push({ productSlug, colorId, sides: layersBySide, savedAt: Date.now() });
      localStorage.setItem("kcp-designs", JSON.stringify(all));
      setNotice("Design saved on this device. It will be here when you return.");
    } finally { setSaving(false); }
  }
  function addCart() {
    if (!lines.length) { setNotice("Add at least one size and quantity."); setStep(2); return; }
    const p = priceFor(product, sidesUsed, lines as { size: SizeKey; qty: number }[]);
    addToCart({ key: `${Date.now()}`, productSlug: product.slug, productName: product.name, kind: product.kind, colorId: color.id, colorName: color.name, colorHex: color.hex, sides: layersBySide, previewFront: toPreview("front"), previewBack: sidesUsed > 1 || layersBySide.back.length ? toPreview("back") : null, lines, unit: p.unit, total: p.total, count: p.count, createdAt: Date.now() });
    router.push("/cart");
  }

  return (
    <div style={{ background: "#fff" }}>
      <div style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="wrap" style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 10, paddingBottom: 10 }}>
          <Link href="/" aria-label="Back home" style={{ fontSize: 20 }}>←</Link>
          <strong style={{ fontSize: 14 }}>Design Studio</strong>
          <ol style={{ display: "flex", gap: 18, listStyle: "none", margin: "0 0 0 12px", padding: 0 }} aria-label="Progress">
            {(["Design", "Quantity", "Review"] as const).map((label, i) => (
              <li key={label} style={{ display: "flex", alignItems: "center", gap: 8, color: step === i + 1 ? "var(--orange)" : "#999", fontWeight: 700, fontSize: 13 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: step === i + 1 ? "var(--orange)" : "#ccc", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>{label.toUpperCase()}
              </li>
            ))}
          </ol>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={saveDesign} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            {step < 3 ? <button className="btn" style={{ background: "var(--orange)", borderColor: "var(--orange)" }} onClick={() => setStep(step === 1 ? 2 : 3)}>Next</button> : <button className="btn" onClick={addCart}>Add to cart · {formatUSD(price.total)}</button>}
          </div>
        </div>
      </div>
      {notice && <div role="status" className="wrap" style={{ background: "#fff8e6", border: "1px solid #e8c96a", padding: "10px 14px", marginTop: 10, borderRadius: 6, fontSize: 14 }}>{notice}</div>}
      <div className="wrap" style={{ display: "grid", gridTemplateColumns: "280px 1fr 300px", gap: 18, paddingTop: 16, paddingBottom: 90 }}>
        <aside aria-label="Design tools" style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", alignSelf: "start" }}>
          <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid var(--line)" }} role="tablist" aria-label="Studio tools">
            {(["products", "text", "upload", "art", "layers"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} style={{ flex: "1 1 30%", padding: "10px 6px", fontSize: 12, fontWeight: 700, background: tab === t ? "#111" : "#fff", color: tab === t ? "#fff" : "#111", border: 0, cursor: "pointer", textTransform: "capitalize" }}>{t}</button>)}
          </div>
          <div style={{ padding: 14 }}>
            {tab === "products" && <div style={{ display: "grid", gap: 8 }}>{PRODUCTS.map((p) => <button key={p.slug} onClick={() => { setProductSlug(p.slug); setColorId(p.colors[0].id); }} style={{ textAlign: "left", border: p.slug === productSlug ? "2px solid #111" : "1px solid var(--line)", borderRadius: 6, padding: 8, background: "#fff", cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}><span style={{ width: 44 }}><GarmentSVG kind={p.kind} hex={p.colors[0].hex} id={p.slug} /></span><span><strong style={{ fontSize: 13 }}>{p.name}</strong><br /><span className="small muted">from {formatUSD(p.basePrice)}</span></span></button>)}</div>}
            {tab === "text" && (
              <div style={{ display: "grid", gap: 10 }}>
                <label className="lbl" htmlFor="st-text">Text</label>
                <input id="st-text" className="input" value={text} maxLength={40} onChange={(e) => setText(e.target.value)} />
                <label className="lbl" htmlFor="st-font">Font</label>
                <select id="st-font" className="input" value={font} onChange={(e) => setFont(e.target.value)}>{FONTS.map((f) => <option key={f} value={f}>{f.split(",")[0]}</option>)}</select>
                <label className="lbl" htmlFor="st-color">Color</label>
                <input id="st-color" type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ width: "100%", height: 40 }} />
                <button className="btn" onClick={addTextLayer}>Add text to {side}</button>
                {selected?.type === "text" && (
                  <fieldset style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 10 }}>
                    <legend className="small">Selected text</legend>
                    <label className="lbl" htmlFor="sel-size">Size</label>
                    <input id="sel-size" type="range" min={18} max={90} value={selected.size ?? 42} onChange={(e) => updateLayer(selected.id, { size: Number(e.target.value) })} style={{ width: "100%" }} />
                    <label className="lbl" htmlFor="sel-rot">Rotation</label>
                    <input id="sel-rot" type="range" min={-45} max={45} value={selected.rotation} onChange={(e) => updateLayer(selected.id, { rotation: Number(e.target.value) })} style={{ width: "100%" }} />
                    <label className="lbl" htmlFor="sel-scale">Scale</label>
                    <input id="sel-scale" type="range" min={0.4} max={2.5} step={0.05} value={selected.scale} onChange={(e) => updateLayer(selected.id, { scale: Number(e.target.value) })} style={{ width: "100%" }} />
                  </fieldset>
                )}
              </div>
            )}
            {tab === "upload" && (
              <div style={{ display: "grid", gap: 10 }}>
                <p className="small muted" style={{ margin: 0 }}>PNG, JPG, SVG or WebP up to 15MB. Best at 300 DPI with transparent background.</p>
                <label className="btn ghost" style={{ cursor: "pointer" }}>Choose file<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => onUpload(e.target.files?.[0])} /></label>
              </div>
            )}
            {tab === "art" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {CLIPART.map((c) => <button key={c.name} onClick={() => addImageLayer(svgURL(c.svg), c.name)} style={{ border: "1px solid var(--line)", borderRadius: 6, background: "#fff", padding: 8, cursor: "pointer" }}><img src={svgURL(c.svg)} alt={c.name} width={64} height={44} /><div className="small">{c.name}</div></button>)}
              </div>
            )}
            {tab === "layers" && (
              <div style={{ display: "grid", gap: 8 }}>
                {layers.length === 0 && <p className="small muted">No layers on {side} yet. Add text or artwork.</p>}
                {[...layers].reverse().map((l) => (
                  <div key={l.id} style={{ border: selectedId === l.id ? "2px solid #111" : "1px solid var(--line)", borderRadius: 6, padding: 8, display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={() => setSelectedId(l.id)} style={{ flex: 1, textAlign: "left", background: "none", border: 0, cursor: "pointer", fontSize: 13 }}><strong>{l.type === "text" ? l.text : l.name}</strong><br /><span className="muted">{l.type}</span></button>
                    <button aria-label="Delete layer" onClick={() => { setLayersBySide((s) => ({ ...s, [side]: s[side].filter((x) => x.id !== l.id) })); if (selectedId === l.id) setSelectedId(null); }} style={{ border: "1px solid var(--line)", background: "#fff", borderRadius: 4, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
                {selected?.type === "image" && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <label className="lbl" htmlFor="img-scale">Scale</label>
                    <input id="img-scale" type="range" min={0.3} max={3} step={0.05} value={selected.scale} onChange={(e) => updateLayer(selected.id, { scale: Number(e.target.value) })} style={{ width: "100%" }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn ghost" style={{ flex: 1 }} onClick={() => updateLayer(selected.id, { rotation: selected.rotation - 15 })}>⟲</button>
                      <button className="btn ghost" style={{ flex: 1 }} onClick={() => updateLayer(selected.id, { rotation: selected.rotation + 15 })}>⟳</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        <section aria-label="Preview">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button className="btn ghost" onClick={() => setSide(side === "front" ? "back" : "front")} aria-label={`Rotate to ${side === "front" ? "back" : "front"}`}>⇄ Rotate · {side === "front" ? "Front" : "Back"}</button>
          </div>
          <canvas
            ref={canvasRef} width={520} height={620}
            style={{ width: "100%", height: "auto", border: "1px solid var(--line)", borderRadius: 8, touchAction: "none", cursor: selectedId ? "move" : "default" }}
            role="application" aria-label={`${product.name} ${side} preview. Drag layers to position them.`}
            onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); const p = pos(e); const id = hitTest(p.x, p.y); setSelectedId(id); if (id) { const l = layers.find((x) => x.id === id)!; drag.current = { id, dx: p.x - l.x, dy: p.y - l.y }; } }}
            onPointerMove={(e) => { if (!drag.current) return; const p = pos(e); updateLayer(drag.current.id, { x: p.x - drag.current.dx, y: p.y - drag.current.dy }); }}
            onPointerUp={() => { drag.current = null; }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn ghost" onClick={() => { const s = canvasRef.current?.toDataURL("image/png"); if (s) { const a = document.createElement("a"); a.href = s; a.download = `${productSlug}-${side}.png`; a.click(); } }}>Download preview</button>
            <button className="btn ghost" onClick={async () => { const data = { productSlug, colorId, sides: layersBySide }; try { if (navigator.share) await navigator.share({ title: "My Kingdom design", text: "Check my custom design", url: location.href }); else { await navigator.clipboard.writeText(location.href); setNotice("Link copied. Share it with anyone."); } } catch { void data; } }}>Share</button>
            {selected && <button className="btn ghost" onClick={() => { setLayersBySide((s) => ({ ...s, [side]: s[side].filter((x) => x.id !== selected.id) })); setSelectedId(null); }}>Remove selected</button>}
          </div>
          {step === 2 && (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <h3 style={{ margin: "0 0 8px" }}>Quantity by size</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                {product.sizes.map((s) => <div key={s}><label className="lbl" htmlFor={`q-${s}`}>{s}</label><input id={`q-${s}`} className="input" type="number" min={0} max={999} value={qtyMap[s] ?? 0} onChange={(e) => setQtyMap((m) => ({ ...m, [s]: Math.max(0, Number(e.target.value) || 0) }))} /></div>)}
              </div>
              <p className="small muted">Bulk savings apply automatically at 6, 12 and 24+ units.</p>
            </div>
          )}
          {step === 3 && (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <h3 style={{ margin: "0 0 8px" }}>Review</h3>
              <p className="small" style={{ margin: "4px 0" }}><strong>{product.name}</strong> · {color.name} · {sidesUsed === 0 ? "No print (blank)" : `${sidesUsed} side${sidesUsed > 1 ? "s" : ""} printed`}</p>
              <p className="small" style={{ margin: "4px 0" }}>{lines.length ? lines.map((l) => `${l.size} × ${l.qty}`).join(" · ") : "No quantities yet — go back to Quantity."} </p>
              <p style={{ fontSize: 18 }}><strong>Total {formatUSD(price.total)}</strong> <span className="muted small">({formatUSD(price.unit)}/unit)</span></p>
            </div>
          )}
        </section>

        <aside aria-label="Summary" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, alignSelf: "start" }}>
          <h3 style={{ margin: "0 0 6px" }}>{product.name}</h3>
          <p className="small muted" style={{ margin: "0 0 10px" }}>{formatUSD(product.basePrice)} blank + {formatUSD(product.printFeePerSide)}/printed side</p>
          <label className="lbl" htmlFor="c-color">Color</label>
          <select id="c-color" className="input" value={colorId} onChange={(e) => setColorId(e.target.value)}>{product.colors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {(["front", "back"] as const).map((s) => <button key={s} onClick={() => setSide(s)} aria-pressed={side === s} className="btn ghost" style={{ flex: 1, background: side === s ? "#111" : "#fff", color: side === s ? "#fff" : "#111" }}>{s} ({layersBySide[s].length})</button>)}
          </div>
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 12, paddingTop: 12, display: "grid", gap: 4, fontSize: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Units</span><strong>{price.count}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Per unit</span><strong>{formatUSD(price.unit)}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}><span>Total</span><strong>{formatUSD(price.total)}</strong></div>
          </div>
          <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={() => (step < 3 ? setStep(step === 1 ? 2 : 3) : addCart())}>{step < 3 ? "Continue" : "Add to cart"}</button>
          <Link href="/shop" className="small" style={{ display: "block", textAlign: "center", marginTop: 10, textDecoration: "underline" }}>or keep browsing blanks</Link>
        </aside>
      </div>
      <style>{`@media(max-width:1080px){div.wrap[style*="280px 1fr 300px"]{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}

export default function CustomizePage() {
  return <Suspense fallback={<div className="wrap" style={{ padding: 40 }}>Loading studio…</div>}><StudioInner /></Suspense>;
}
