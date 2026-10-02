"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  Design,
  DesignLayer,
  GarmentSide,
  ImageLayer,
  TextLayer,
} from "@/lib/types";
import { layerBox, teeArea } from "@/lib/design";
import { svgFontStack } from "@/lib/fonts";

type Tool = "move" | "scale" | "rotate";
type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface CanvasProps {
  frontSrc: string;
  backSrc: string;
  side: GarmentSide;
  design: Design;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (side: GarmentSide, id: string, patch: Partial<DesignLayer>) => void;
  onCommit: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, dir: "front" | "back" | "forward" | "backward") => void;
}

const VIEW = 900;

interface Box {
  w: number;
  h: number;
}

interface DragState {
  id: string;
  tool: Tool;
  edge: Edge | null;
  originX: number;
  originY: number;
  originSX: number;
  originSY: number;
  originRotation: number;
  startPx: number;
  startPy: number;
  startDist: number;
  pivot: { x: number; y: number };
  base: Box;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

const effBox = (base: Box, layer: DesignLayer): Box => ({
  w: base.w * layer.scaleX,
  h: base.h * layer.scaleY,
});

export default function DesignCanvas({
  frontSrc,
  backSrc,
  side,
  design,
  selectedId,
  onSelect,
  onChange,
  onCommit,
  onDuplicate,
  onDelete,
  onReorder,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  const frac = teeArea(side);
  const area = useMemo(
    () => ({ w: VIEW * frac.w, h: VIEW * frac.h }),
    [frac.w, frac.h]
  );
  const areaOrigin = useMemo(
    () => ({ x: VIEW * frac.cx - area.w / 2, y: VIEW * frac.cy - area.h / 2 }),
    [frac.cx, frac.cy, area.w, area.h]
  );

  const layers = design[side];
  const selected = selectedId ? layers.find((l) => l.id === selectedId) : undefined;
  const photo = side === "front" ? frontSrc : backSrc;

  const toView = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW,
      y: ((clientY - rect.top) / rect.height) * VIEW,
    };
  }, []);

  const startDrag = (
    event: ReactPointerEvent,
    layer: DesignLayer,
    nextTool: Tool,
    edge: Edge | null = null
  ) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();

    const pt = toView(event.clientX, event.clientY);
    if (!pt) return;

    const pivot = {
      x: areaOrigin.x + (layer.x / 100) * area.w,
      y: areaOrigin.y + (layer.y / 100) * area.h,
    };
    const base = layerBox(layer, area);

    onSelect(layer.id);
    dragRef.current = {
      id: layer.id,
      tool: nextTool,
      edge,
      originX: layer.x,
      originY: layer.y,
      originSX: layer.scaleX,
      originSY: layer.scaleY,
      originRotation: layer.rotation,
      startPx: pt.x,
      startPy: pt.y,
      startDist: Math.hypot(pt.x - pivot.x, pt.y - pivot.y) || 1,
      pivot,
      base,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const s = dragRef.current;
      if (!s) return;
      const pt = toView(e.clientX, e.clientY);
      if (!pt) return;

      if (s.tool === "move") {
        const dx = ((pt.x - s.startPx) / area.w) * 100;
        const dy = ((pt.y - s.startPy) / area.h) * 100;
        onChange(side, s.id, {
          x: round2(clamp(s.originX + dx, -10, 110)),
          y: round2(clamp(s.originY + dy, -10, 110)),
        });
        return;
      }

      if (s.tool === "scale") {
        if (s.edge && s.edge.length === 1) {
          // Edge handles stretch a single axis.
          const dx = pt.x - s.pivot.x;
          const dy = pt.y - s.pivot.y;
          if (s.edge === "e" || s.edge === "w") {
            onChange(side, s.id, { scaleX: round2(clamp(Math.abs(dx) / (s.base.w / 2), 0.05, 8)) });
          } else {
            onChange(side, s.id, { scaleY: round2(clamp(Math.abs(dy) / (s.base.h / 2), 0.05, 8)) });
          }
          return;
        }
        // Corner handles scale proportionally.
        const dist = Math.hypot(pt.x - s.pivot.x, pt.y - s.pivot.y);
        const k = dist / s.startDist;
        onChange(side, s.id, {
          scaleX: round2(clamp(s.originSX * k, 0.05, 8)),
          scaleY: round2(clamp(s.originSY * k, 0.05, 8)),
        });
        return;
      }

      const a0 = Math.atan2(s.startPy - s.pivot.y, s.startPx - s.pivot.x);
      const a1 = Math.atan2(pt.y - s.pivot.y, pt.x - s.pivot.x);
      let deg = s.originRotation + ((a1 - a0) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      onChange(side, s.id, { rotation: Math.round(deg) });
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
      onCommit();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, side, area.w, area.h, toView, onChange, onCommit]);

  // Keyboard nudging for the selected layer.
  useEffect(() => {
    if (!selectedId) return;
    const layer = layers.find((l) => l.id === selectedId);
    if (!layer) return;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const step = e.shiftKey ? 5 : 1;
      let handled = true;
      switch (e.key) {
        case "ArrowLeft":
          onChange(side, selectedId, { x: clamp(layer.x - step, -10, 110) });
          break;
        case "ArrowRight":
          onChange(side, selectedId, { x: clamp(layer.x + step, -10, 110) });
          break;
        case "ArrowUp":
          onChange(side, selectedId, { y: clamp(layer.y - step, -10, 110) });
          break;
        case "ArrowDown":
          onChange(side, selectedId, { y: clamp(layer.y + step, -10, 110) });
          break;
        case "[":
          onChange(side, selectedId, { scaleX: clamp(layer.scaleX - 0.05, 0.05, 8), scaleY: clamp(layer.scaleY - 0.05, 0.05, 8) });
          break;
        case "]":
          onChange(side, selectedId, { scaleX: clamp(layer.scaleX + 0.05, 0.05, 8), scaleY: clamp(layer.scaleY + 0.05, 0.05, 8) });
          break;
        case "Delete":
        case "Backspace":
          onDelete(selectedId);
          break;
        case "Escape":
          onSelect(null);
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        onCommit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, layers, side, onChange, onSelect, onCommit, onDelete]);

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="canvas-svg"
        role="img"
        aria-label={`${side} preview with ${layers.length} design element${layers.length === 1 ? "" : "s"}`}
        onPointerDown={() => onSelect(null)}
      >
        <image
          href={photo}
          x={0}
          y={0}
          width={VIEW}
          height={VIEW}
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        />

        <rect
          x={areaOrigin.x}
          y={areaOrigin.y}
          width={area.w}
          height={area.h}
          fill="none"
          stroke="rgba(200,16,46,0.55)"
          strokeWidth="1.6"
          strokeDasharray="7 6"
          pointerEvents="none"
        />

        <g clipPath="url(#print-clip)">
          <defs>
            <clipPath id="print-clip">
              <rect x={areaOrigin.x} y={areaOrigin.y} width={area.w} height={area.h} />
            </clipPath>
          </defs>
          {layers.map((layer) => (
            <LayerNode
              key={layer.id}
              layer={layer}
              area={area}
              areaOrigin={areaOrigin}
              selected={layer.id === selectedId}
              onPointerDown={startDrag}
            />
          ))}
        </g>
      </svg>

      {selected ? (
        <div className="canvas-float" role="toolbar" aria-label="Selected element">
          <span className="canvas-float-name">
            {selected.type === "text" ? selected.text.split("\n")[0] || "Text" : selected.name}
          </span>
          <button type="button" onClick={() => onChange(side, selected.id, { flipH: !selected.flipH })} title="Flip horizontal">
            <FlipIcon axis="h" />
          </button>
          <button type="button" onClick={() => onChange(side, selected.id, { flipV: !selected.flipV })} title="Flip vertical">
            <FlipIcon axis="v" />
          </button>
          <button type="button" onClick={() => onReorder(selected.id, "forward")} title="Bring forward">
            <OrderIcon dir="up" />
          </button>
          <button type="button" onClick={() => onReorder(selected.id, "backward")} title="Send backward">
            <OrderIcon dir="down" />
          </button>
          <button type="button" onClick={() => onDuplicate(selected.id)} title="Duplicate">
            <DupIcon />
          </button>
          <button type="button" className="is-danger" onClick={() => onDelete(selected.id)} title="Delete">
            <TrashIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LayerNode({
  layer,
  area,
  areaOrigin,
  selected,
  onPointerDown,
}: {
  layer: DesignLayer;
  area: { w: number; h: number };
  areaOrigin: { x: number; y: number };
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent, layer: DesignLayer, tool: Tool, edge?: Edge | null) => void;
}) {
  const cx = areaOrigin.x + (layer.x / 100) * area.w;
  const cy = areaOrigin.y + (layer.y / 100) * area.h;
  const base = layerBox(layer, area);
  const box = effBox(base, layer);
  const fh = layer.flipH ? -1 : 1;
  const fv = layer.flipV ? -1 : 1;

  const handles: { edge: Edge; x: number; y: number }[] = [
    { edge: "nw", x: -box.w / 2, y: -box.h / 2 },
    { edge: "n", x: 0, y: -box.h / 2 },
    { edge: "ne", x: box.w / 2, y: -box.h / 2 },
    { edge: "e", x: box.w / 2, y: 0 },
    { edge: "se", x: box.w / 2, y: box.h / 2 },
    { edge: "s", x: 0, y: box.h / 2 },
    { edge: "sw", x: -box.w / 2, y: box.h / 2 },
    { edge: "w", x: -box.w / 2, y: 0 },
  ];

  const cursor: Record<Edge, string> = {
    nw: "nwse-resize",
    n: "ns-resize",
    ne: "nesw-resize",
    e: "ew-resize",
    se: "nwse-resize",
    s: "ns-resize",
    sw: "nesw-resize",
    w: "ew-resize",
  };

  return (
    <g>
      {/* Content, scaled */}
      <g transform={`translate(${cx} ${cy}) rotate(${layer.rotation}) scale(${layer.scaleX * fh} ${layer.scaleY * fv})`} opacity={layer.opacity}>
        {layer.type === "image" ? (
          <image
            href={(layer as ImageLayer).src}
            x={-area.w / 2}
            y={-area.h / 2}
            width={area.w}
            height={area.h}
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
          />
        ) : (
          <TextNode layer={layer as TextLayer} area={area} />
        )}
      </g>

      {/* Hit area + selection UI, rotation only (handles stay constant size) */}
      <g transform={`translate(${cx} ${cy}) rotate(${layer.rotation})`}>
        <rect
          x={-box.w / 2 - 6}
          y={-box.h / 2 - 6}
          width={box.w + 12}
          height={box.h + 12}
          fill="transparent"
          style={{ cursor: "move" }}
          onPointerDown={(e) => onPointerDown(e, layer, "move")}
        />

        {selected ? (
          <>
            <rect
              x={-box.w / 2}
              y={-box.h / 2}
              width={box.w}
              height={box.h}
              fill="none"
              stroke="#c8102e"
              strokeWidth="2"
              pointerEvents="none"
            />
            <line
              x1={0}
              y1={-box.h / 2}
              x2={0}
              y2={-box.h / 2 - 34}
              stroke="#c8102e"
              strokeWidth="2"
              pointerEvents="none"
            />
            <circle
              cx={0}
              cy={-box.h / 2 - 40}
              r={11}
              fill="#fff"
              stroke="#c8102e"
              strokeWidth="2"
              style={{ cursor: "grab" }}
              onPointerDown={(e) => onPointerDown(e, layer, "rotate")}
            />
            {handles.map((h) => (
              <rect
                key={h.edge}
                x={h.x - 8}
                y={h.y - 8}
                width={16}
                height={16}
                rx={3}
                fill="#fff"
                stroke="#c8102e"
                strokeWidth="2"
                style={{ cursor: cursor[h.edge] }}
                onPointerDown={(e) => onPointerDown(e, layer, "scale", h.edge)}
              />
            ))}
          </>
        ) : null}
      </g>
    </g>
  );
}

function TextNode({
  layer,
  area,
}: {
  layer: TextLayer;
  area: { w: number; h: number };
}) {
  const lines = layer.text.split("\n");
  const size = (layer.fontSize / 100) * area.h;
  const anchor = layer.align === "left" ? "start" : layer.align === "right" ? "end" : "middle";
  const offset =
    layer.align === "left" ? -area.w * 0.45 : layer.align === "right" ? area.w * 0.45 : 0;
  const firstDy = -((lines.length - 1) * size * layer.lineHeight) / 2;
  const stroke = layer.strokeWidth > 0 ? layer.strokeColor : "none";

  return (
    <text
      x={offset}
      y={0}
      textAnchor={anchor}
      dominantBaseline="middle"
      fill={layer.color}
      stroke={stroke}
      strokeWidth={(layer.strokeWidth / 100) * size}
      strokeLinejoin="round"
      paintOrder="stroke"
      fontSize={size}
      fontFamily={svgFontStack(layer.font)}
      fontWeight={layer.weight}
      fontStyle={layer.italic ? "italic" : "normal"}
      letterSpacing={(layer.letterSpacing / 100) * size}
      pointerEvents="none"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={offset} dy={i === 0 ? firstDy : size * layer.lineHeight}>
          {layer.uppercase ? line.toUpperCase() : line}
        </tspan>
      ))}
    </text>
  );
}

/* --------------------------------- icons --------------------------------- */

function FlipIcon({ axis }: { axis: "h" | "v" }) {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d={axis === "h" ? "M9 2v14M6 5 2.5 9 6 13M12 5l3.5 4L12 13" : "M2 9h14M5 6 9 2.5 13 6M5 12l4 3.5L13 12"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OrderIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d={dir === "up" ? "M9 14V4m0 0L5 8m4-4 4 4" : "M9 4v10m0 0 4-4m-4 4-4-4"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DupIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 6V4.5A1.5 1.5 0 0 0 10.5 3h-6A1.5 1.5 0 0 0 3 4.5v6A1.5 1.5 0 0 0 4.5 12H6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M3 5h12M7.5 5V3.5h3V5M5 5l.8 10.2A1 1 0 0 0 6.8 16h4.4a1 1 0 0 0 1-.8L13 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
