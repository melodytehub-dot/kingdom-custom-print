"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { createSubjectCutout, selectSubject, type SubjectBox, type SubjectMask, type SubjectPoint, type SubjectSelectionProgress } from "@/lib/subjectSelection";
import { BackArrowIcon } from "./icons";

function drawMaskPreview(image: HTMLImageElement, canvas: HTMLCanvasElement, mask: Uint8Array, width: number, height: number) {
  const displayWidth = Math.max(1, image.clientWidth);
  const displayHeight = Math.max(1, image.clientHeight);
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  const context = canvas.getContext("2d");
  if (!context) return;
  const imageData = context.createImageData(displayWidth, displayHeight);
  for (let y = 0; y < displayHeight; y++) {
    const maskY = Math.min(height - 1, Math.floor((y / displayHeight) * height));
    for (let x = 0; x < displayWidth; x++) {
      const maskX = Math.min(width - 1, Math.floor((x / displayWidth) * width));
      const alpha = Math.round(mask[maskY * width + maskX] * 0.42);
      const pixel = (y * displayWidth + x) * 4;
      imageData.data[pixel] = 28;
      imageData.data[pixel + 1] = 156;
      imageData.data[pixel + 2] = 111;
      imageData.data[pixel + 3] = alpha;
    }
  }
  context.putImageData(imageData, 0, 0);
}

function paintBrushSegment(
  mask: Uint8Array,
  width: number,
  height: number,
  displayWidth: number,
  displayHeight: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  diameter: number,
  keep: boolean,
) {
  const radiusX = Math.max(1, (diameter / 2) * (width / displayWidth));
  const radiusY = Math.max(1, (diameter / 2) * (height / displayHeight));
  const distance = Math.hypot((to.x - from.x) * width, (to.y - from.y) * height);
  const steps = Math.max(1, Math.ceil(distance / (Math.min(radiusX, radiusY) * 0.35)));

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const centerX = (from.x + (to.x - from.x) * t) * width;
    const centerY = (from.y + (to.y - from.y) * t) * height;
    const xStart = Math.max(0, Math.floor(centerX - radiusX));
    const xEnd = Math.min(width - 1, Math.ceil(centerX + radiusX));
    const yStart = Math.max(0, Math.floor(centerY - radiusY));
    const yEnd = Math.min(height - 1, Math.ceil(centerY + radiusY));

    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        const distanceFromCenter = Math.hypot((x - centerX) / radiusX, (y - centerY) / radiusY);
        if (distanceFromCenter >= 1) continue;
        const coverage = Math.min(1, Math.max(0, (1 - distanceFromCenter) / 0.22));
        const index = y * width + x;
        mask[index] = Math.round(keep
          ? mask[index] + (255 - mask[index]) * coverage
          : mask[index] * (1 - coverage));
      }
    }
  }
}

export function SubjectSelectionEditor({
  src,
  eyebrow,
  onBack,
  onApply,
}: {
  src: string;
  eyebrow: string;
  onBack: () => void;
  onApply: (cutout: string) => Promise<void>;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const boxDrag = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);
  const brushDrag = useRef<{ pointerId: number; mask: Uint8Array; last: { x: number; y: number } } | null>(null);
  const [points, setPoints] = useState<SubjectPoint[]>([]);
  const [selection, setSelection] = useState<SubjectMask | null>(null);
  const [brushUndo, setBrushUndo] = useState<ArrayBuffer[]>([]);
  const [mode, setMode] = useState<0 | 1>(1);
  const [tool, setTool] = useState<"points" | "box" | "brush">("points");
  const [selectionBox, setSelectionBox] = useState<SubjectBox | null>(null);
  const [draftBox, setDraftBox] = useState<SubjectBox | null>(null);
  const [brushSize, setBrushSize] = useState(28);
  const [brushCursor, setBrushCursor] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<SubjectSelectionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = maskCanvasRef.current;
    if (!image || !canvas || !selection) return;

    const draw = () => {
      drawMaskPreview(image, canvas, new Uint8Array(selection.mask), selection.width, selection.height);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(image);
    return () => observer.disconnect();
  }, [selection]);

  const predict = async (nextPoints: SubjectPoint[], nextBox = selectionBox) => {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const result = await selectSubject(src, nextPoints, setProgress, nextBox ?? undefined);
      setSelection(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not find that object. Try another point.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const normalizedPoint = (clientX: number, clientY: number) => {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const normalizedBox = (x1: number, y1: number, x2: number, y2: number): SubjectBox => ({
    x1: Math.min(x1, x2),
    y1: Math.min(y1, y2),
    x2: Math.max(x1, x2),
    y2: Math.max(y1, y2),
  });

  const addPoint = (event: MouseEvent<HTMLDivElement>) => {
    if (tool !== "points" || busy || applying) return;
    const position = normalizedPoint(event.clientX, event.clientY);
    if (!position) return;
    const point = {
      ...position,
      label: mode,
    } satisfies SubjectPoint;
    const nextPoints = [...points, point];
    setPoints(nextPoints);
    setBrushUndo([]);
    setSelection(null);
    void predict(nextPoints);
  };

  const beginBox = (event: PointerEvent<HTMLDivElement>) => {
    if (tool !== "box" || busy || applying) return;
    const start = normalizedPoint(event.clientX, event.clientY);
    if (!start) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    boxDrag.current = { pointerId: event.pointerId, startX: start.x, startY: start.y };
    setDraftBox(normalizedBox(start.x, start.y, start.x, start.y));
  };

  const moveBox = (event: PointerEvent<HTMLDivElement>) => {
    const drag = boxDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = normalizedPoint(event.clientX, event.clientY);
    if (current) setDraftBox(normalizedBox(drag.startX, drag.startY, current.x, current.y));
  };

  const finishBox = (event: PointerEvent<HTMLDivElement>) => {
    const drag = boxDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    boxDrag.current = null;
    const end = normalizedPoint(event.clientX, event.clientY);
    setDraftBox(null);
    if (!end) return;
    const nextBox = normalizedBox(drag.startX, drag.startY, end.x, end.y);
    if (nextBox.x2 - nextBox.x1 < 0.04 || nextBox.y2 - nextBox.y1 < 0.04) {
      setError("Draw a larger box around the item.");
      return;
    }
    setPoints([]);
    setBrushUndo([]);
    setSelectionBox(nextBox);
    setSelection(null);
    void predict([], nextBox);
  };

  const cancelBox = (event: PointerEvent<HTMLDivElement>) => {
    if (boxDrag.current?.pointerId !== event.pointerId) return;
    boxDrag.current = null;
    setDraftBox(null);
  };

  const beginBrush = (event: PointerEvent<HTMLDivElement>) => {
    if (tool !== "brush" || busy || applying) return;
    if (!selection) {
      setError("Choose Points or Box and select an object first.");
      return;
    }
    const position = normalizedPoint(event.clientX, event.clientY);
    const image = imageRef.current;
    if (!position || !image) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const mask = new Uint8Array(selection.mask).slice();
    setBrushUndo((history) => [...history.slice(-7), selection.mask.slice(0)]);
    brushDrag.current = { pointerId: event.pointerId, mask, last: position };
    paintBrushSegment(mask, selection.width, selection.height, image.clientWidth, image.clientHeight, position, position, brushSize, mode === 1);
    if (maskCanvasRef.current) drawMaskPreview(image, maskCanvasRef.current, mask, selection.width, selection.height);
  };

  const moveBrush = (event: PointerEvent<HTMLDivElement>) => {
    if (tool !== "brush") return;
    const position = normalizedPoint(event.clientX, event.clientY);
    if (position) setBrushCursor(position);
    const drag = brushDrag.current;
    const image = imageRef.current;
    const canvas = maskCanvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !image || !canvas || !selection) return;
    const next = normalizedPoint(event.clientX, event.clientY);
    if (!next) return;
    paintBrushSegment(drag.mask, selection.width, selection.height, image.clientWidth, image.clientHeight, drag.last, next, brushSize, mode === 1);
    drag.last = next;
    drawMaskPreview(image, canvas, drag.mask, selection.width, selection.height);
  };

  const finishBrush = (event: PointerEvent<HTMLDivElement>) => {
    const drag = brushDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    brushDrag.current = null;
    setSelection((current) => current ? { ...current, mask: drag.mask.buffer as ArrayBuffer } : current);
  };

  const cancelBrush = (event: PointerEvent<HTMLDivElement>) => {
    const drag = brushDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    brushDrag.current = null;
    if (selection && imageRef.current && maskCanvasRef.current) {
      drawMaskPreview(imageRef.current, maskCanvasRef.current, new Uint8Array(selection.mask), selection.width, selection.height);
    }
  };

  const undoPoint = () => {
    if (busy) return;
    if (brushUndo.length && selection) {
      const previous = brushUndo[brushUndo.length - 1];
      setBrushUndo(brushUndo.slice(0, -1));
      setSelection({ ...selection, mask: previous });
      return;
    }
    if (!points.length) {
      if (selectionBox) {
        setSelectionBox(null);
        setSelection(null);
      }
      return;
    }
    const nextPoints = points.slice(0, -1);
    setPoints(nextPoints);
    setError(null);
    if (nextPoints.length || selectionBox) {
      void predict(nextPoints);
    } else {
      setSelection(null);
    }
  };

  const clearPoints = () => {
    if (busy) return;
    setPoints([]);
    setBrushUndo([]);
    setSelectionBox(null);
    setSelection(null);
    setError(null);
  };

  const apply = async () => {
    if (!selection || busy || applying) return;
    setApplying(true);
    setError(null);
    try {
      const cutout = await createSubjectCutout(src, selection);
      await onApply(cutout);
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not apply this cutout.");
    } finally {
      setApplying(false);
    }
  };

  const progressText = progress?.phase === "download"
    ? "Downloading the selection model for this browser…"
    : progress?.phase === "prepare"
      ? "Analyzing the image…"
      : progress?.phase === "segment"
        ? "Updating the outline…"
        : "Preparing cutout…";

  return (
    <div className="rot-editor rot-subject-editor">
      <div className="rot-editor-scroll">
        <header className="rot-phead">
          <div className="rot-phead-row">
            <div>
              <p className="rot-eyebrow">{eyebrow}</p>
              <h2 className="rot-ptitle">Select an Object</h2>
            </div>
            <button type="button" className="rot-iconbtn" onClick={onBack} disabled={busy || applying} aria-label="Back">
              <BackArrowIcon size={26} />
            </button>
          </div>
          <p className="rot-phint">{tool === "box" ? "Drag a box around the product, then refine the outline with points or a brush." : tool === "brush" ? "Paint areas to Keep or Remove. Undo reverses the last stroke." : "Tap the item to keep. Add Remove points over anything that gets included by mistake."}</p>
        </header>

        <div className="rot-subject-tools" role="group" aria-label="Selection method">
          <button type="button" aria-pressed={tool === "points"} className={tool === "points" ? "is-active" : ""} disabled={busy || applying} onClick={() => setTool("points")}>
            Points
          </button>
          <button type="button" aria-pressed={tool === "box"} className={tool === "box" ? "is-active" : ""} disabled={busy || applying} onClick={() => setTool("box")}>
            Box
          </button>
          <button type="button" aria-pressed={tool === "brush"} className={tool === "brush" ? "is-active" : ""} disabled={busy || applying} onClick={() => setTool("brush")}>
            Brush
          </button>
        </div>

        {tool !== "box" ? (
          <div className="rot-subject-modes" role="group" aria-label={tool === "brush" ? "Brush mode" : "Point selection mode"}>
            <button type="button" aria-pressed={mode === 1} className={mode === 1 ? "is-active" : ""} disabled={busy || applying} onClick={() => setMode(1)}>
              Keep
            </button>
            <button type="button" aria-pressed={mode === 0} className={mode === 0 ? "is-active" : ""} disabled={busy || applying || (!points.some((point) => point.label === 1) && !(tool === "brush" && selection))} onClick={() => setMode(0)}>
              Remove
            </button>
          </div>
        ) : null}

        <div className={`rot-subject-stage${busy || applying ? " is-busy" : ""}`}>
          <div
            className={`rot-subject-target${tool === "box" ? " is-box-mode" : ""}${tool === "brush" ? " is-brush-mode" : ""}`}
            data-tool={tool}
            onClick={tool === "points" ? addPoint : undefined}
            onPointerDown={(event) => { beginBox(event); beginBrush(event); }}
            onPointerMove={(event) => { moveBox(event); moveBrush(event); }}
            onPointerUp={(event) => { finishBox(event); finishBrush(event); }}
            onPointerCancel={(event) => { cancelBox(event); cancelBrush(event); }}
            onPointerLeave={() => setBrushCursor(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imageRef} src={src} alt="Artwork to cut out" draggable={false} />
            <canvas ref={maskCanvasRef} className="rot-subject-mask" aria-hidden="true" />
            {selectionBox ? (
              <span className="rot-subject-box" style={{ left: `${selectionBox.x1 * 100}%`, top: `${selectionBox.y1 * 100}%`, width: `${(selectionBox.x2 - selectionBox.x1) * 100}%`, height: `${(selectionBox.y2 - selectionBox.y1) * 100}%` }} aria-hidden="true" />
            ) : null}
            {draftBox ? (
              <span className="rot-subject-box is-draft" style={{ left: `${draftBox.x1 * 100}%`, top: `${draftBox.y1 * 100}%`, width: `${(draftBox.x2 - draftBox.x1) * 100}%`, height: `${(draftBox.y2 - draftBox.y1) * 100}%` }} aria-hidden="true" />
            ) : null}
            {points.map((point, index) => (
              <span
                key={`${index}-${point.x}-${point.y}`}
                className={`rot-subject-point${point.label === 1 ? " is-keep" : " is-remove"}`}
                style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                aria-hidden="true"
              >
                {point.label === 1 ? "+" : "−"}
              </span>
            ))}
            {tool === "brush" && brushCursor ? (
              <span className="rot-subject-brush-cursor" style={{ left: `${brushCursor.x * 100}%`, top: `${brushCursor.y * 100}%`, width: brushSize, height: brushSize }} aria-hidden="true" />
            ) : null}
          </div>
          {busy ? <span className="rot-subject-wait" role="status">{progressText}</span> : null}
        </div>

        {tool === "brush" ? (
          <label className="rot-subject-brush-size">
            <span>Brush size</span>
            <input type="range" min={8} max={64} step={2} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
            <output>{brushSize}px</output>
          </label>
        ) : null}

        <div className="rot-subject-actions">
          <span>{points.length ? `${points.length} point${points.length === 1 ? "" : "s"}` : selectionBox ? "Box selected" : "Tap or draw on the image"}</span>
          <div>
            <button type="button" onClick={undoPoint} disabled={busy || (!points.length && !brushUndo.length && !selectionBox)}>Undo</button>
            <button type="button" onClick={clearPoints} disabled={busy || (!points.length && !brushUndo.length && !selectionBox && !selection)}>Clear</button>
          </div>
        </div>

        {busy && progress?.phase === "download" && progress.percent !== undefined ? (
          <progress className="rot-subject-progress" max={100} value={progress.percent} aria-label="Selection model download progress" />
        ) : null}
        {error ? <p className="rot-subject-error" role="alert">{error}</p> : null}
        {selection && !busy ? <p className="rot-phint">{tool === "brush" ? "Paint over the mask to clean up missed areas or restore edges." : "Outline updated. Add more Keep or Remove points to refine it."}</p> : null}
      </div>

      <div className="rot-subject-footer">
        <button type="button" className="rot-textlink" onClick={onBack} disabled={busy || applying}>Cancel</button>
        <button type="button" className="rot-cta" onClick={() => void apply()} disabled={!selection || busy || applying}>
          {applying ? "Applying…" : "Use Cutout"}
        </button>
      </div>
    </div>
  );
}
