"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Garment from "@/components/Garment";
import type {
  Design,
  DesignLayer,
  GarmentSide,
  ImageLayer,
  PrintArea,
  ProductKind,
  TextLayer,
} from "@/lib/types";
import { areaFor } from "@/lib/design";

type Tool = "move" | "scale" | "rotate";

interface CanvasProps {
  product: { kind: ProductKind; name: string; printArea: PrintArea };
  color: string;
  design: Design;
  side: GarmentSide;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (side: GarmentSide, id: string, patch: Partial<DesignLayer>) => void;
  onCommit: () => void;
}

const VIEW_W = 320;
const VIEW_H = 340;

/** Matches the garment artwork box so the print area overlays the fabric. */
const GARMENT_FRAME = { x: 40, y: 42, w: 240, h: 268 } as const;

interface DragState {
  id: string;
  tool: Tool;
  originX: number;
  originY: number;
  originScale: number;
  originRotation: number;
  startPx: number;
  startPy: number;
  pivot: { x: number; y: number };
}

export default function DesignCanvas({
  product,
  color,
  design,
  side,
  selectedId,
  onSelect,
  onChange,
  onCommit,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<Tool>("move");
  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const frac = areaFor(product.printArea, side);
  const area = useMemo(
    () => ({
      x: GARMENT_FRAME.x + (GARMENT_FRAME.w * (1 - frac.w)) / 2,
      y: GARMENT_FRAME.y + (GARMENT_FRAME.h * (1 - frac.h)) / 2,
      w: GARMENT_FRAME.w * frac.w,
      h: GARMENT_FRAME.h * frac.h,
    }),
    [frac.w, frac.h]
  );

  const layers = design[side];

  /** Maps a pointer event into SVG viewBox coordinates. */
  const toView = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_W,
      y: ((clientY - rect.top) / rect.height) * VIEW_H,
    };
  }, []);

  const startDrag = (
    event: ReactPointerEvent,
    layer: DesignLayer,
    nextTool: Tool
  ) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();

    const pt = toView(event.clientX, event.clientY);
    if (!pt) return;

    onSelect(layer.id);
    setTool(nextTool);
    dragRef.current = {
      id: layer.id,
      tool: nextTool,
      originX: layer.x,
      originY: layer.y,
      originScale: layer.scale,
      originRotation: layer.rotation,
      startPx: pt.x,
      startPy: pt.y,
      pivot: { x: area.x + area.w / 2, y: area.y + area.h / 2 },
    };
    setIsDragging(true);
  };

  // Pointermove/Up live on window so a fast drag that leaves the SVG still tracks.
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const pt = toView(e.clientX, e.clientY);
      if (!pt) return;

      if (state.tool === "move") {
        const dx = ((pt.x - state.startPx) / area.w) * 100;
        const dy = ((pt.y - state.startPy) / area.h) * 100;
        onChange(side, state.id, {
          x: clamp(state.originX + dx, 0, 100),
          y: clamp(state.originY + dy, 0, 100),
        });
        return;
      }

      if (state.tool === "scale") {
        const dy = (pt.y - state.startPy) / area.h;
        const next = clamp(state.originScale + dy * 1.6, 0.12, 3);
        onChange(side, state.id, { scale: Math.round(next * 100) / 100 });
        return;
      }

      const a0 = Math.atan2(state.startPy - state.pivot.y, state.startPx - state.pivot.x);
      const a1 = Math.atan2(pt.y - state.pivot.y, pt.x - state.pivot.x);
      let deg = state.originRotation + ((a1 - a0) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      onChange(side, state.id, { rotation: Math.round(deg) });
    };

    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
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
  }, [isDragging, side, area.w, area.h, toView, onChange, onCommit]);

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
          onChange(side, selectedId, { x: clamp(layer.x - step, 0, 100) });
          break;
        case "ArrowRight":
          onChange(side, selectedId, { x: clamp(layer.x + step, 0, 100) });
          break;
        case "ArrowUp":
          onChange(side, selectedId, { y: clamp(layer.y - step, 0, 100) });
          break;
        case "ArrowDown":
          onChange(side, selectedId, { y: clamp(layer.y + step, 0, 100) });
          break;
        case "[":
          onChange(side, selectedId, { scale: clamp(layer.scale - 0.05, 0.12, 3) });
          break;
        case "]":
          onChange(side, selectedId, { scale: clamp(layer.scale + 0.05, 0.12, 3) });
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
  }, [selectedId, layers, side, onChange, onSelect, onCommit]);

  return (
    <div className="canvas-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="canvas-svg"
        role="img"
        aria-label={`${product.name} ${side} preview with ${layers.length} design element${
          layers.length === 1 ? "" : "s"
        }`}
        onPointerDown={() => onSelect(null)}
      >
        <defs>
          <clipPath id="print-clip">
            <rect x={area.x} y={area.y} width={area.w} height={area.h} />
          </clipPath>
        </defs>

        <Garment kind={product.kind} color={color} back={side === "back"} />

        <rect
          x={area.x}
          y={area.y}
          width={area.w}
          height={area.h}
          fill="none"
          stroke="rgba(200,16,46,0.5)"
          strokeWidth="1.4"
          strokeDasharray="5 4"
          pointerEvents="none"
        />

        <g clipPath="url(#print-clip)">
          {layers.map((layer) => (
            <LayerNode
              key={layer.id}
              layer={layer}
              area={area}
              selected={layer.id === selectedId}
              onPointerDown={startDrag}
            />
          ))}
        </g>
      </svg>

      <div className="canvas-bar">
        {selectedId ? (
          <>
            <div className="tool-group" role="group" aria-label="Active tool">
              <ToolButton active={tool === "move"} onClick={() => setTool("move")}>
                Move
              </ToolButton>
              <ToolButton active={tool === "scale"} onClick={() => setTool("scale")}>
                Resize
              </ToolButton>
              <ToolButton active={tool === "rotate"} onClick={() => setTool("rotate")}>
                Rotate
              </ToolButton>
            </div>
            <p className="canvas-hint small muted">
              Drag to place. Arrow keys nudge, [ and ] resize.
            </p>
          </>
        ) : (
          <p className="canvas-hint small muted">
            Select text or artwork on the garment to position it.
          </p>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Approximate rendered size of a layer in SVG units, used for handles and hit areas. */
function layerBox(
  layer: DesignLayer,
  area: { w: number; h: number }
): { w: number; h: number } {
  if (layer.type === "image") {
    return {
      w: Math.max(8, (area.w * layer.scale) / 100),
      h: Math.max(8, (area.h * layer.scale * 0.86) / 100),
    };
  }
  const lines = layer.text.split("\n").length || 1;
  const longest = Math.max(...layer.text.split("\n").map((l) => l.length), 1);
  const charW = (layer.fontSize / 100) * area.h * 0.52;
  const w = Math.min(area.w * 0.98, Math.max(12, longest * charW)) * layer.scale;
  const h = Math.min(
    area.h * 0.98,
    lines * ((layer.fontSize / 100) * area.h * 1.02) * layer.lineHeight
  ) * layer.scale;
  return { w, h };
}

function LayerNode({
  layer,
  area,
  selected,
  onPointerDown,
}: {
  layer: DesignLayer;
  area: { x: number; y: number; w: number; h: number };
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent, layer: DesignLayer, tool: Tool) => void;
}) {
  const cx = area.x + (layer.x / 100) * area.w;
  const cy = area.y + (layer.y / 100) * area.h;
  const box = layerBox(layer, area);

  return (
    <g transform={`translate(${cx} ${cy}) rotate(${layer.rotation})`}>
      {/* Generous invisible hit area so small elements stay selectable on touch. */}
      <rect
        x={-box.w / 2 - 8}
        y={-box.h / 2 - 8}
        width={box.w + 16}
        height={box.h + 16}
        fill="transparent"
        style={{ cursor: "move" }}
        onPointerDown={(e) => onPointerDown(e, layer, "move")}
      />

{layer.type === "image" ? (
        <image
          href={(layer as ImageLayer).src}
          x={-box.w / 2}
          y={-box.h / 2}
          width={box.w}
          height={box.h}
          opacity={(layer as ImageLayer).opacity}
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        />
      ) : (
        <TextNode layer={layer as TextLayer} area={area} pointerEvents="none" />
      )}

      {selected ? (
        <>
          <rect
            x={-box.w / 2 - 4}
            y={-box.h / 2 - 4}
            width={box.w + 8}
            height={box.h + 8}
            fill="none"
            stroke="#c8102e"
            strokeWidth="1.3"
            strokeDasharray="4 3"
            pointerEvents="none"
          />
          {/* Handles stay interactive so the tool can be switched by dragging them. */}
          <circle
            cx={0}
            cy={-box.h / 2 - 5}
            r="6"
            fill="#fff"
            stroke="#c8102e"
            strokeWidth="1.4"
            style={{ cursor: "ns-resize" }}
            onPointerDown={(e) => onPointerDown(e, layer, "scale")}
          />
          <circle
            cx={box.w / 2 + 5}
            cy={-box.h / 2 - 5}
            r="6"
            fill="#fff"
            stroke="#c8102e"
            strokeWidth="1.4"
            style={{ cursor: "grab" }}
            onPointerDown={(e) => onPointerDown(e, layer, "rotate")}
          />
        </>
      ) : null}
    </g>
  );
}

function TextNode({
  layer,
  area,
  pointerEvents,
}: {
  layer: TextLayer;
  area: { w: number; h: number };
  pointerEvents?: string;
}) {
  const lines = layer.text.split("\n");
  const size = (layer.fontSize / 100) * area.h;
  const anchor = layer.align === "left" ? "start" : layer.align === "right" ? "end" : "middle";
  const offset = layer.align === "left" ? -area.w * 0.42 : layer.align === "right" ? area.w * 0.42 : 0;

  const family =
    layer.font === "anton"
      ? "var(--font-anton), 'Arial Narrow', sans-serif"
      : layer.font === "inter"
        ? "var(--font-inter), system-ui, sans-serif"
        : "Georgia, 'Times New Roman', serif";

  const firstDy = -((lines.length - 1) * size * layer.lineHeight) / 2;

  return (
    <text
      x={offset}
      y={0}
      textAnchor={anchor}
      dominantBaseline="middle"
      fill={layer.color}
      fontSize={size}
      fontFamily={family}
      fontWeight={layer.weight}
      fontStyle={layer.italic ? "italic" : "normal"}
      letterSpacing={(layer.letterSpacing / 100) * size}
      pointerEvents={pointerEvents}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={offset} dy={i === 0 ? firstDy : size * layer.lineHeight}>
          {layer.uppercase ? line.toUpperCase() : line}
        </tspan>
      ))}
    </text>
  );
}