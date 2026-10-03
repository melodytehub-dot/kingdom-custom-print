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
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
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
  onDelete,
  onEdit,
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

        <defs>
          <clipPath id="print-clip">
            <rect x={areaOrigin.x} y={areaOrigin.y} width={area.w} height={area.h} />
          </clipPath>
        </defs>

        {/* Artwork is clipped to the printable area… */}
        <g clipPath="url(#print-clip)">
          {layers.map((layer) => (
            <LayerContent key={layer.id} layer={layer} area={area} areaOrigin={areaOrigin} />
          ))}
        </g>

        {/* …but the hit areas and controls live above the clip so they never
            get cut off at the print boundary. */}
        <g>
          {layers.map((layer) => (
            <LayerOverlay
              key={layer.id}
              layer={layer}
              area={area}
              areaOrigin={areaOrigin}
              selected={layer.id === selectedId}
              onPointerDown={startDrag}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

function LayerContent({
  layer,
  area,
  areaOrigin,
}: {
  layer: DesignLayer;
  area: { w: number; h: number };
  areaOrigin: { x: number; y: number };
}) {
  const cx = areaOrigin.x + (layer.x / 100) * area.w;
  const cy = areaOrigin.y + (layer.y / 100) * area.h;
  const fh = layer.flipH ? -1 : 1;
  const fv = layer.flipV ? -1 : 1;

  return (
    <g
      transform={`translate(${cx} ${cy}) rotate(${layer.rotation}) scale(${layer.scaleX * fh} ${layer.scaleY * fv})`}
      opacity={layer.opacity}
    >
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
  );
}

function LayerOverlay({
  layer,
  area,
  areaOrigin,
  selected,
  onPointerDown,
  onDelete,
  onEdit,
}: {
  layer: DesignLayer;
  area: { w: number; h: number };
  areaOrigin: { x: number; y: number };
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent, layer: DesignLayer, tool: Tool, edge?: Edge | null) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const cx = areaOrigin.x + (layer.x / 100) * area.w;
  const cy = areaOrigin.y + (layer.y / 100) * area.h;
  const base = layerBox(layer, area);
  const box = effBox(base, layer);
  const halfW = box.w / 2;
  const halfH = box.h / 2;
  const GAP = 58;

  return (
    <g transform={`translate(${cx} ${cy}) rotate(${layer.rotation})`}>
      <rect
        x={-halfW - 6}
        y={-halfH - 6}
        width={box.w + 12}
        height={box.h + 12}
        fill="transparent"
        style={{ cursor: "move" }}
        onPointerDown={(e) => onPointerDown(e, layer, "move")}
      />

      {selected ? (
        <>
          <rect
            x={-halfW}
            y={-halfH}
            width={box.w}
            height={box.h}
            fill="none"
            stroke="#2f7bff"
            strokeWidth="2.5"
            strokeDasharray="8 6"
            pointerEvents="none"
          />

          <ControlButton
            x={-halfW - GAP}
            y={-halfH - GAP}
            label="Delete"
            onActivate={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(layer.id);
            }}
          >
            <TrashIcon />
          </ControlButton>

          <ControlButton
            x={0}
            y={-halfH - GAP}
            label="Stretch vertically"
            onActivate={(e) => onPointerDown(e, layer, "scale", "n")}
          >
            <StretchIcon axis="v" />
          </ControlButton>

          <ControlButton
            x={halfW + GAP}
            y={-halfH - GAP}
            label="Rotate"
            onActivate={(e) => onPointerDown(e, layer, "rotate")}
          >
            <RotateIcon />
          </ControlButton>

          <ControlButton
            x={halfW + GAP}
            y={0}
            label="Stretch horizontally"
            onActivate={(e) => onPointerDown(e, layer, "scale", "e")}
          >
            <StretchIcon axis="h" />
          </ControlButton>

          <ControlButton
            x={-halfW - GAP}
            y={halfH + GAP}
            label="Edit text"
            onActivate={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(layer.id);
            }}
          >
            <text textAnchor="middle" dominantBaseline="central" fontSize="21" fontWeight="600" fill="#2c2b28">
              edit
            </text>
          </ControlButton>

          <ControlButton
            x={halfW + GAP}
            y={halfH + GAP}
            label="Resize"
            onActivate={(e) => onPointerDown(e, layer, "scale", "se")}
          >
            <ScaleIcon />
          </ControlButton>
        </>
      ) : null}
    </g>
  );
}

function ControlButton({
  x,
  y,
  label,
  onActivate,
  children,
}: {
  x: number;
  y: number;
  label: string;
  onActivate: (e: ReactPointerEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{ cursor: "pointer" }}
      onPointerDown={onActivate}
      role="button"
      aria-label={label}
    >
      <circle r={38} fill="#fff" stroke="#d9d5cd" strokeWidth={1.5} />
      {children}
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

function Icon({ children, transform }: { children: React.ReactNode; transform?: string }) {
  return (
    <svg
      x={-15}
      y={-15}
      width={30}
      height={30}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2c2b28"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      transform={transform}
    >
      {children}
    </svg>
  );
}

function TrashIcon() {
  return (
    <Icon>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </Icon>
  );
}

function StretchIcon({ axis }: { axis: "h" | "v" }) {
  return (
    <Icon transform={axis === "h" ? "rotate(90)" : undefined}>
      <path d="M12 4v16" />
      <path d="M8 8l4-4 4 4" />
      <path d="M8 16l4 4 4-4" />
    </Icon>
  );
}

function RotateIcon() {
  return (
    <Icon>
      <path d="M23 4v6h-6" />
      <path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10" />
    </Icon>
  );
}

function ScaleIcon() {
  return (
    <Icon>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </Icon>
  );
}
