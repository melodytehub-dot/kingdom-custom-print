"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  Design,
  DesignLayer,
  GarmentSide,
  ImageLayer,
  PrintArea,
  TextLayer,
} from "@/lib/types";
import { areaFor, layerBox, teeArea } from "@/lib/design";
import { svgFontStack } from "@/lib/fonts";
import { arcPath, measureTextLayer } from "./textGeometry";

type Tool = "move" | "scale" | "rotate";
type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface CanvasProps {
  frontSrc: string;
  backSrc: string;
  side: GarmentSide;
  printArea?: PrintArea;
  design: Design;
  selectedId: string | null;
  compact?: boolean;
  renderSize?: number;
  onSelect: (id: string | null) => void;
  onTap: (id: string) => void;
  onChange: (side: GarmentSide, id: string, patch: Partial<DesignLayer>) => void;
  onCommit: () => void;
  onGestureStart?: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  style?: CSSProperties;
}

export const VIEW = 900;

interface Box {
  w: number;
  h: number;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
  locked: boolean;
  rect: { left: number; top: number; width: number; height: number };
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
  rotation: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

const effBox = (base: Box, layer: DesignLayer): Box => ({
  w: base.w * layer.scaleX,
  h: base.h * layer.scaleY,
});

/** Geometry of the printable area in view units, shared with the stage. */
export function printAreaView(side: GarmentSide, printArea?: PrintArea) {
  const configured = printArea ? areaFor(printArea, side) : null;
  const frac = configured
    ? {
        w: configured.w,
        h: configured.h,
        cx: 0.5,
        cy: side === "front" ? 0.47 : 0.45,
      }
    : teeArea(side);
  const w = VIEW * frac.w;
  const h = VIEW * frac.h;
  return { w, h, x: VIEW * frac.cx - w / 2, y: VIEW * frac.cy - h / 2 };
}

const DISTRESS_THRESHOLD = [0, 0.3, 0.42, 0.52];

export default function DesignCanvas({
  frontSrc,
  backSrc,
  side,
  printArea,
  design,
  selectedId,
  compact = false,
  renderSize = VIEW,
  onSelect,
  onTap,
  onChange,
  onCommit,
  onGestureStart,
  onDelete,
  onEdit,
  style,
}: CanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState<Tool | null>(null);
  const uid = useId().replace(/:/g, "");

  const pa = useMemo(() => printAreaView(side, printArea), [side, printArea]);
  const area = useMemo(() => ({ w: pa.w, h: pa.h }), [pa.w, pa.h]);
  const areaOrigin = useMemo(() => ({ x: pa.x, y: pa.y }), [pa.x, pa.y]);

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
    if (dragRef.current) return;

    const pt = toView(event.clientX, event.clientY);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!pt || !rect || (layer.locked && nextTool !== "move")) return;

    const pivot = {
      x: areaOrigin.x + (layer.x / 100) * area.w,
      y: areaOrigin.y + (layer.y / 100) * area.h,
    };

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      locked: Boolean(layer.locked),
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
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
      base: layerBox(layer, area),
      rotation: layer.rotation,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (nextTool !== "move") onGestureStart?.();
    setDragging(nextTool);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const s = dragRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      e.preventDefault();
      if (s.tool === "move" && !s.moved) {
        if (Math.hypot(e.clientX - s.startClientX, e.clientY - s.startClientY) <= 6) return;
        s.moved = true;
        if (!s.locked) onGestureStart?.();
        onSelect(s.id);
      }
      if (s.locked) return;
      // Measure from the gesture's original frame, even if the viewport changes.
      const pt = {
        x: ((e.clientX - s.rect.left) / s.rect.width) * VIEW,
        y: ((e.clientY - s.rect.top) / s.rect.height) * VIEW,
      };

      if (s.tool === "move") {
        const dx = ((pt.x - s.startPx) / area.w) * 100;
        const dy = ((pt.y - s.startPy) / area.h) * 100;
        const x = clamp(s.originX + dx, -40, 140);
        const y = clamp(s.originY + dy, -30, 130);
        // Keep snapping equally precise at every zoom and screen size.
        const toleranceX = (5 * VIEW * 100) / (s.rect.width * area.w);
        const toleranceY = (5 * VIEW * 100) / (s.rect.height * area.h);
        onChange(side, s.id, {
          x: round2(!e.altKey && Math.abs(x - 50) < toleranceX ? 50 : x),
          y: round2(!e.altKey && Math.abs(y - 50) < toleranceY ? 50 : y),
        });
        return;
      }

      if (s.tool === "scale") {
        if (s.edge && s.edge.length === 1) {
          // Edge handles stretch one axis, measured in the layer's own frame
          // so rotated layers stretch along their own edges.
          const rad = (-s.rotation * Math.PI) / 180;
          const vx = pt.x - s.pivot.x;
          const vy = pt.y - s.pivot.y;
          const lx = vx * Math.cos(rad) - vy * Math.sin(rad);
          const ly = vx * Math.sin(rad) + vy * Math.cos(rad);
          if (s.edge === "e" || s.edge === "w") {
            onChange(side, s.id, { scaleX: round2(clamp(Math.abs(lx) / (s.base.w / 2), 0.05, 8)) });
          } else {
            onChange(side, s.id, { scaleY: round2(clamp(Math.abs(ly) / (s.base.h / 2), 0.05, 8)) });
          }
          return;
        }
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
      deg = ((((deg + 180) % 360) + 360) % 360) - 180;
      // Snap to upright / quarter turns when close, like the reference.
      for (const snap of [-180, -90, 0, 90, 180]) {
        if (Math.abs(deg - snap) < 3) deg = snap;
      }
      onChange(side, s.id, { rotation: Math.round(e.shiftKey ? Math.round(deg / 15) * 15 : deg) });
    };

    const onUp = (e: PointerEvent) => {
      const s = dragRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      dragRef.current = null;
      setDragging(null);
      if (!s.locked && (s.moved || s.tool !== "move")) onCommit();
      if (e.type === "pointercancel") return;
      if (s.tool === "move" && !s.moved) {
        if (Math.hypot(e.clientX - s.startClientX, e.clientY - s.startClientY) <= 6) onTap(s.id);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, side, area.w, area.h, onChange, onCommit, onSelect, onTap, onGestureStart]);

  // Keyboard nudging for the selected layer (desktop).
  useEffect(() => {
    if (!selectedId) return;
    const layer = layers.find((l) => l.id === selectedId);
    if (!layer || layer.locked) return;

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      const step = e.shiftKey ? 5 : 1;
      let handled = true;
      switch (e.key) {
        case "ArrowLeft":
          onChange(side, selectedId, { x: clamp(layer.x - step, -40, 140) });
          break;
        case "ArrowRight":
          onChange(side, selectedId, { x: clamp(layer.x + step, -40, 140) });
          break;
        case "ArrowUp":
          onChange(side, selectedId, { y: clamp(layer.y - step, -30, 130) });
          break;
        case "ArrowDown":
          onChange(side, selectedId, { y: clamp(layer.y + step, -30, 130) });
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

  const levels = useMemo(
    () => [...new Set(layers.map((l) => l.distress ?? 0).filter((n) => n > 0))],
    [layers]
  );

  return (
    <div className="rot-canvas" style={style}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="rot-canvas-svg"
        role="img"
        aria-label={`${side} preview with ${layers.length} design element${layers.length === 1 ? "" : "s"}`}
        onPointerDown={() => { if (!dragRef.current) onSelect(null); }}
      >
        <defs>
          {levels.map((lv) => (
            <filter
              key={lv}
              id={`${uid}-dst-${lv}`}
              x="-2%"
              y="-2%"
              width="104%"
              height="104%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.09 0.11"
                numOctaves="3"
                seed="11"
                result="noise"
              />
              <feColorMatrix
                in="noise"
                type="matrix"
                values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  16 0 0 0 ${-16 * DISTRESS_THRESHOLD[lv]}`}
                result="mask"
              />
              <feComposite in="SourceGraphic" in2="mask" operator="in" />
            </filter>
          ))}
        </defs>

        <image
          href={photo}
          className="rot-shirt-photo"
          x={0}
          y={0}
          width={VIEW}
          height={VIEW}
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        />

        {/* Print-area guide, only while a layer is being dragged. */}
        {dragging === "move" ? (
          <rect
            x={areaOrigin.x}
            y={areaOrigin.y}
            width={area.w}
            height={area.h}
            fill="none"
            stroke="#2f7bff"
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeDasharray="10 8"
            pointerEvents="none"
          />
        ) : null}

        {dragging === "move" && layers.filter((layer) => layer.id === selectedId).map((layer) => (
          <g key={`guides-${layer.id}`} stroke="#e74879" strokeWidth={2} pointerEvents="none" data-alignment-guides>
            {layer.x === 50 ? <line x1={areaOrigin.x + area.w / 2} x2={areaOrigin.x + area.w / 2} y1={areaOrigin.y} y2={areaOrigin.y + area.h} /> : null}
            {layer.y === 50 ? <line x1={areaOrigin.x} x2={areaOrigin.x + area.w} y1={areaOrigin.y + area.h / 2} y2={areaOrigin.y + area.h / 2} /> : null}
          </g>
        ))}

        <g>
          {layers.map((layer) => (
            <LayerContent
              key={layer.id}
              layer={layer}
              area={area}
              areaOrigin={areaOrigin}
              uid={uid}
            />
          ))}
        </g>

        <g>
          {[...layers.filter((layer) => layer.id !== selectedId), ...layers.filter((layer) => layer.id === selectedId)].map((layer) => (
            <LayerOverlay
              key={layer.id}
              layer={layer}
              area={area}
              areaOrigin={areaOrigin}
              selected={layer.id === selectedId}
              compact={compact}
              handleScale={((compact ? 44 : 32) * VIEW) / (68 * Math.max(renderSize, 1))}
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
  uid,
}: {
  layer: DesignLayer;
  area: { w: number; h: number };
  areaOrigin: { x: number; y: number };
  uid: string;
}) {
  const cx = areaOrigin.x + (layer.x / 100) * area.w;
  const cy = areaOrigin.y + (layer.y / 100) * area.h;
  const fh = layer.flipH ? -1 : 1;
  const fv = layer.flipV ? -1 : 1;
  const lv = layer.distress ?? 0;
  const base = layerBox(layer, area);

  return (
    <g
      transform={`translate(${cx} ${cy}) rotate(${layer.rotation}) scale(${layer.scaleX * fh} ${layer.scaleY * fv})`}
      opacity={layer.opacity}
      filter={lv > 0 ? `url(#${uid}-dst-${lv})` : undefined}
    >
      {layer.type === "image" ? (
        <image
          href={(layer as ImageLayer).src}
          x={-base.w / 2}
          y={-base.h / 2}
          width={base.w}
          height={base.h}
          preserveAspectRatio="none"
          pointerEvents="none"
        />
      ) : (
        <TextNode layer={layer as TextLayer} area={area} uid={`${uid}-${layer.id}`} />
      )}
    </g>
  );
}

function TextNode({
  layer,
  area,
  uid,
}: {
  layer: TextLayer;
  area: { w: number; h: number };
  uid: string;
}) {
  const m = measureTextLayer(layer, area.h);
  const { size, lines, arc } = m;
  const anchor = layer.align === "left" ? "start" : layer.align === "right" ? "end" : "middle";
  const offset =
    layer.align === "left" ? -m.w / 2 : layer.align === "right" ? m.w / 2 : 0;
  const stroke = layer.strokeWidth > 0 ? layer.strokeColor : "none";
  const common = {
    fill: layer.color,
    stroke,
    strokeWidth: (layer.strokeWidth / 100) * size,
    strokeLinejoin: "round" as const,
    paintOrder: "stroke" as const,
    fontSize: size,
    fontFamily: svgFontStack(layer.font),
    fontWeight: layer.weight,
    fontStyle: layer.italic ? ("italic" as const) : ("normal" as const),
    letterSpacing: (layer.letterSpacing / 100) * size,
    pointerEvents: "none" as const,
  };

  if (arc) {
    const yShift = (layer.arc > 0 ? -1 : 1) * (arc.sagitta / 2);
    const d = arcPath(arc, layer.arc);
    return (
      <g>
        {lines.map((line, i) => {
          const dy = (i - (lines.length - 1) / 2) * size * layer.lineHeight;
          const id = `${uid}-arc-${i}`;
          return (
            <g key={i} transform={`translate(0 ${yShift + size * 0.35 + dy})`}>
              <path id={id} d={d} fill="none" stroke="none" />
              <text {...common} textAnchor="middle">
                <textPath href={`#${id}`} startOffset="50%">
                  {layer.uppercase ? line.toUpperCase() : line}
                </textPath>
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  const firstDy = -((lines.length - 1) * size * layer.lineHeight) / 2;
  return (
    <text x={offset} y={0} textAnchor={anchor} dominantBaseline="middle" {...common}>
      {lines.map((line, i) => (
        <tspan key={i} x={offset} dy={i === 0 ? firstDy : size * layer.lineHeight}>
          {layer.uppercase ? line.toUpperCase() : line}
        </tspan>
      ))}
    </text>
  );
}

function LayerOverlay({
  layer,
  area,
  areaOrigin,
  selected,
  compact,
  handleScale,
  onPointerDown,
  onDelete,
  onEdit,
}: {
  layer: DesignLayer;
  area: { w: number; h: number };
  areaOrigin: { x: number; y: number };
  selected: boolean;
  compact: boolean;
  handleScale: number;
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
  const GAP = 44 * handleScale;
  const isText = layer.type === "text";
  const radians = layer.rotation * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const margin = 42 * handleScale;
  const rx = halfW + GAP, ry = halfH + GAP;
  // Keep the resize target inside the canvas, including short landscape views.
  const screenX = clamp(cx + rx * cos - ry * sin, margin, VIEW - margin) - cx;
  const screenY = clamp(cy + rx * sin + ry * cos, margin, VIEW - margin) - cy;
  const resizeX = screenX * cos + screenY * sin;
  const resizeY = -screenX * sin + screenY * cos;

  return (
    <g transform={`translate(${cx} ${cy}) rotate(${layer.rotation})`}>
      <rect
        x={-halfW - 6}
        y={-halfH - 6}
        width={box.w + 12}
        height={box.h + 12}
        fill="transparent"
        style={{ cursor: layer.locked ? "pointer" : "move" }}
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

          {!compact ? <ControlButton
            x={-halfW - GAP}
            y={-halfH - GAP}
            label="Delete"
            scale={handleScale}
            onActivate={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(layer.id);
            }}
          >
            <TrashIcon />
          </ControlButton> : null}

          {!layer.locked ? (
            <>
              {!compact ? <>
              <ControlButton
                x={0}
                y={-halfH - GAP}
                label="Stretch vertically"
                scale={handleScale}
                shape="pill"
                onActivate={(e) => onPointerDown(e, layer, "scale", "n")}
              >
                <StretchIcon axis="v" />
              </ControlButton>

              <ControlButton
                x={halfW + GAP}
                y={-halfH - GAP}
                label="Rotate"
                scale={handleScale}
                onActivate={(e) => onPointerDown(e, layer, "rotate")}
              >
                <RotateIcon />
              </ControlButton>

              <ControlButton
                x={halfW + GAP}
                y={0}
                label="Stretch horizontally"
                scale={handleScale}
                shape="pill"
                onActivate={(e) => onPointerDown(e, layer, "scale", "e")}
              >
                <StretchIcon axis="h" />
              </ControlButton>

              {isText ? (
                <ControlButton
                  x={-halfW - GAP}
                  y={halfH + GAP}
                  label="Edit text"
                  scale={handleScale}
                  onActivate={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEdit(layer.id);
                  }}
                >
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="19"
                    fontWeight="500"
                    fill="#2c2b28"
                  >
                    edit
                  </text>
                </ControlButton>
              ) : null}
              </> : null}

              <ControlButton
                x={resizeX}
                y={resizeY}
                scale={handleScale}
                label="Resize"
                onActivate={(e) => onPointerDown(e, layer, "scale", "se")}
              >
                <ScaleIcon />
              </ControlButton>
            </>
          ) : null}
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
  shape = "circle",
  scale = 1,
  children,
}: {
  x: number;
  y: number;
  label: string;
  onActivate: (e: ReactPointerEvent) => void;
  shape?: "circle" | "pill";
  scale?: number;
  children: React.ReactNode;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      style={{ cursor: "pointer" }}
      onPointerDown={onActivate}
      role="button"
      aria-label={label}
    >
      {shape === "circle" ? (
        <circle r={34} fill="#fff" stroke="#cfd3d9" strokeWidth={2} />
      ) : (
        <rect x={-24} y={-30} width={48} height={60} rx={4} fill="#fff" stroke="#cfd3d9" strokeWidth={2} />
      )}
      {children}
    </g>
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
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7" />
    </Icon>
  );
}

function StretchIcon({ axis }: { axis: "h" | "v" }) {
  return (
    <Icon transform={axis === "h" ? "rotate(90 15 15)" : undefined}>
      <path d="M12 4v16" />
      <path d="M8 8l4-4 4 4" />
      <path d="M8 16l4 4 4-4" />
    </Icon>
  );
}

function RotateIcon() {
  return (
    <Icon>
      <path d="M21 4v6h-6" />
      <path d="M20 14a8 8 0 1 1-2.3-7.3L21 10" />
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
