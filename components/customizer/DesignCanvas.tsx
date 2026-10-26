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
  selectedIds: string[];
  compact?: boolean;
  renderSize?: number;
  interactionMode?: "select" | "pan";
  onSelect: (ids: string[]) => void;
  onTap: (id: string) => void;
  onChange: (side: GarmentSide, id: string, patch: Partial<DesignLayer>) => void;
  onCommit: () => void;
  onGestureStart?: () => void;
  onDelete: (ids: string[]) => void;
  onEdit: (id: string) => void;
  onUngroup?: (ids: string[]) => void;
  style?: CSSProperties;
}

export const VIEW = 900;

interface Box {
  w: number;
  h: number;
}

/** One layer caught in a gesture, frozen at the moment the gesture began. */
interface MemberState {
  id: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  base: Box;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  moved: boolean;
  /** True when the selection cannot be transformed, so only a tap is possible. */
  locked: boolean;
  rect: { left: number; top: number; width: number; height: number };
  /** Every layer the gesture moves - one layer, or all members of a group. */
  ids: string[];
  tool: Tool;
  edge: Edge | null;
  members: MemberState[];
  startPx: number;
  startPy: number;
  startDist: number;
  startLx: number;
  startLy: number;
  /** Scale/rotate turn around this point: the layer, or the group's centre. */
  pivot: { x: number; y: number };
  base: Box;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

const effBox = (base: Box, layer: DesignLayer): Box => ({
  w: base.w * layer.scaleX,
  h: base.h * layer.scaleY,
});

/**
 * The layers a gesture on `layer` should carry: the current multi-selection
 * when the layer is part of it, otherwise the layer's whole group, otherwise
 * just the layer. The layer the user actually grabbed wins, so a stale copy in
 * the caller is never used for its own geometry.
 */
export function gestureMembers(
  layer: DesignLayer,
  layers: DesignLayer[],
  selectedIds: string[]
): DesignLayer[] {
  if (selectedIds.length > 1 && selectedIds.includes(layer.id)) {
    const picked = layers.filter((l) => selectedIds.includes(l.id));
    if (picked.length > 1) {
      return picked.map((l) => (l.id === layer.id ? layer : l));
    }
  }
  if (layer.groupId) {
    const peers = layers.filter((l) => l.groupId === layer.groupId);
    if (peers.length > 1) return peers.map((l) => (l.id === layer.id ? layer : l));
  }
  return [layer];
}

/** Centre of a layer's box, in view units. */
function centreOf(layer: { x: number; y: number }, area: Box, areaOrigin: { x: number; y: number }) {
  return {
    x: areaOrigin.x + (layer.x / 100) * area.w,
    y: areaOrigin.y + (layer.y / 100) * area.h,
  };
}

/**
 * Axis-aligned box that encloses a set of layers, corners included, in view
 * units. This is the frame a group is grabbed, scaled and rotated by.
 */
export function selectionFrame(
  layers: DesignLayer[],
  area: Box,
  areaOrigin: { x: number; y: number }
): { x: number; y: number; w: number; h: number; cx: number; cy: number } | null {
  if (!layers.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const layer of layers) {
    const c = centreOf(layer, area, areaOrigin);
    const base = layerBox(layer, area);
    const hw = (base.w * layer.scaleX) / 2;
    const hh = (base.h * layer.scaleY) / 2;
    const radians = (layer.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    for (const [dx, dy] of [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]) {
      minX = Math.min(minX, c.x + dx * cos - dy * sin);
      maxX = Math.max(maxX, c.x + dx * cos - dy * sin);
      minY = Math.min(minY, c.y + dx * sin + dy * cos);
      maxY = Math.max(maxY, c.y + dx * sin + dy * cos);
    }
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return { x: minX, y: minY, w, h, cx: minX + w / 2, cy: minY + h / 2 };
}

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
  selectedIds,
  compact = false,
  renderSize = VIEW,
  interactionMode = "select",
  onSelect,
  onTap,
  onChange,
  onCommit,
  onGestureStart,
  onDelete,
  onEdit,
  onUngroup,
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
    if (interactionMode !== "select") return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    if (dragRef.current) return;

    const pt = toView(event.clientX, event.clientY);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!pt || !rect) return;

    // A grouped layer carries its group; a multi-selection carries all of it.
    const picked = gestureMembers(layer, layers, selectedIds);
    const locked = picked.some((l) => l.locked);
    if (locked && nextTool !== "move") return;

    const frame = picked.length > 1 ? selectionFrame(picked, area, areaOrigin) : null;
    const pivot = frame
      ? { x: frame.cx, y: frame.cy }
      : centreOf(layer, area, areaOrigin);

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
      locked,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      ids: picked.map((l) => l.id),
      tool: nextTool,
      edge,
      members: picked.map((l) => ({
        id: l.id,
        x: l.x,
        y: l.y,
        scaleX: l.scaleX,
        scaleY: l.scaleY,
        rotation: l.rotation,
        base: layerBox(l, area),
      })),
      startPx: pt.x,
      startPy: pt.y,
      startDist: Math.hypot(pt.x - pivot.x, pt.y - pivot.y) || 1,
      startLx: pt.x - pivot.x,
      startLy: pt.y - pivot.y,
      pivot,
      base: layerBox(layer, area),
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
        onSelect(s.ids);
      }
      if (s.locked) return;
      // Measure from the gesture's original frame, even if the viewport changes.
      const pt = {
        x: ((e.clientX - s.rect.left) / s.rect.width) * VIEW,
        y: ((e.clientY - s.rect.top) / s.rect.height) * VIEW,
      };
      const solo = s.members.length === 1 ? s.members[0] : null;

      if (s.tool === "move") {
        // One shared delta, clamped so the whole selection stays reachable: a
        // group keeps its shape instead of buckling against the print area.
        const dx = ((pt.x - s.startPx) / area.w) * 100;
        const dy = ((pt.y - s.startPy) / area.h) * 100;
        const xs = s.members.map((m) => m.x);
        const ys = s.members.map((m) => m.y);
        const ddx = clamp(dx, -40 - Math.min(...xs), 140 - Math.max(...xs));
        const ddy = clamp(dy, -30 - Math.min(...ys), 130 - Math.max(...ys));
        // Keep snapping equally precise at every zoom and screen size.
        const toleranceX = (5 * VIEW * 100) / (s.rect.width * area.w);
        const toleranceY = (5 * VIEW * 100) / (s.rect.height * area.h);
        for (const m of s.members) {
          const x = m.x + ddx;
          const y = m.y + ddy;
          onChange(side, m.id, {
            x: round2(!e.altKey && solo && Math.abs(x - 50) < toleranceX ? 50 : x),
            y: round2(!e.altKey && solo && Math.abs(y - 50) < toleranceY ? 50 : y),
          });
        }
        return;
      }

      if (s.tool === "scale") {
        if (solo && s.edge && s.edge.length === 1) {
          // Edge handles stretch one axis, measured in the layer's own frame
          // so rotated layers stretch along their own edges.
          const rad = (-solo.rotation * Math.PI) / 180;
          const vx = pt.x - s.pivot.x;
          const vy = pt.y - s.pivot.y;
          const lx = vx * Math.cos(rad) - vy * Math.sin(rad);
          const ly = vx * Math.sin(rad) + vy * Math.cos(rad);
          if (s.edge === "e" || s.edge === "w") {
            onChange(side, solo.id, { scaleX: round2(clamp(Math.abs(lx) / (solo.base.w / 2), 0.05, 8)) });
          } else {
            onChange(side, solo.id, { scaleY: round2(clamp(Math.abs(ly) / (solo.base.h / 2), 0.05, 8)) });
          }
          return;
        }
        // Corner handle scales both axes together; the pill handles of a group
        // stretch the whole frame along one axis.
        let kx: number;
        let ky: number;
        if (s.edge === "e" || s.edge === "w") {
          kx = Math.abs(pt.x - s.pivot.x) / (Math.abs(s.startLx) || 1);
          ky = 1;
        } else if (s.edge === "n" || s.edge === "s") {
          kx = 1;
          ky = Math.abs(pt.y - s.pivot.y) / (Math.abs(s.startLy) || 1);
        } else {
          kx = Math.hypot(pt.x - s.pivot.x, pt.y - s.pivot.y) / s.startDist;
          ky = kx;
        }
        for (const m of s.members) {
          const c = centreOf(m, area, areaOrigin);
          const nx = s.pivot.x + (c.x - s.pivot.x) * kx;
          const ny = s.pivot.y + (c.y - s.pivot.y) * ky;
          onChange(side, m.id, {
            x: round2(((nx - areaOrigin.x) / area.w) * 100),
            y: round2(((ny - areaOrigin.y) / area.h) * 100),
            scaleX: round2(clamp(m.scaleX * kx, 0.05, 8)),
            scaleY: round2(clamp(m.scaleY * ky, 0.05, 8)),
          });
        }
        return;
      }

      const a0 = Math.atan2(s.startPy - s.pivot.y, s.startPx - s.pivot.x);
      const a1 = Math.atan2(pt.y - s.pivot.y, pt.x - s.pivot.x);
      let delta = ((a1 - a0) * 180) / Math.PI;
      if (e.shiftKey) delta = Math.round(delta / 15) * 15;

      if (solo) {
        let deg = solo.rotation + delta;
        deg = ((((deg + 180) % 360) + 360) % 360) - 180;
        // Snap to upright / quarter turns when close, like the reference.
        for (const snap of [-180, -90, 0, 90, 180]) {
          if (Math.abs(deg - snap) < 3) deg = snap;
        }
        onChange(side, solo.id, { rotation: Math.round(deg) });
        return;
      }

      // A group spins about its own centre so the members keep their layout.
      const rad = (delta * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      for (const m of s.members) {
        const c = centreOf(m, area, areaOrigin);
        const vx = c.x - s.pivot.x;
        const vy = c.y - s.pivot.y;
        const nx = s.pivot.x + vx * cos - vy * sin;
        const ny = s.pivot.y + vx * sin + vy * cos;
        let rot = m.rotation + delta;
        rot = ((((rot + 180) % 360) + 360) % 360) - 180;
        onChange(side, m.id, {
          x: round2(((nx - areaOrigin.x) / area.w) * 100),
          y: round2(((ny - areaOrigin.y) / area.h) * 100),
          rotation: Math.round(rot),
        });
      }
    };

    const onUp = (e: PointerEvent) => {
      const s = dragRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      dragRef.current = null;
      setDragging(null);
      if (!s.locked && (s.moved || s.tool !== "move")) onCommit();
      if (e.type === "pointercancel") return;
      if (s.tool === "move" && !s.moved) {
        if (Math.hypot(e.clientX - s.startClientX, e.clientY - s.startClientY) <= 6) onTap(s.ids[0]);
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
  }, [dragging, side, area, areaOrigin, onChange, onCommit, onSelect, onTap, onGestureStart]);

  // Keyboard nudging for the selected layer (desktop).
  useEffect(() => {
    if (interactionMode !== "select") return;
    const picked = layers.filter((l) => selectedIds.includes(l.id));
    if (!picked.length || picked.every((l) => l.locked)) return;

    const nudge = (dx: number, dy: number) => {
      const xs = picked.map((l) => l.x);
      const ys = picked.map((l) => l.y);
      const ddx = clamp(dx, -40 - Math.min(...xs), 140 - Math.max(...xs));
      const ddy = clamp(dy, -30 - Math.min(...ys), 130 - Math.max(...ys));
      for (const l of picked) {
        if (l.locked) continue;
        onChange(side, l.id, { x: round2(l.x + ddx), y: round2(l.y + ddy) });
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      const step = e.shiftKey ? 5 : 1;
      let handled = true;
      switch (e.key) {
        case "ArrowLeft":
          nudge(-step, 0);
          break;
        case "ArrowRight":
          nudge(step, 0);
          break;
        case "ArrowUp":
          nudge(0, -step);
          break;
        case "ArrowDown":
          nudge(0, step);
          break;
        case "Delete":
        case "Backspace":
          onDelete(selectedIds);
          break;
        case "Escape":
          onSelect([]);
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
  }, [interactionMode, selectedIds, layers, side, area, areaOrigin, onChange, onSelect, onCommit, onDelete]);

  const levels = useMemo(
    () => [...new Set(layers.map((l) => l.distress ?? 0).filter((n) => n > 0))],
    [layers]
  );

  // A group (or any multi-selection) is drawn as one frame with its own handles.
  const picked = useMemo(
    () => layers.filter((l) => selectedIds.includes(l.id)),
    [layers, selectedIds]
  );
  const multi = picked.length > 1;
  const frame = useMemo(
    () => (multi ? selectionFrame(picked, area, areaOrigin) : null),
    [multi, picked, area, areaOrigin]
  );
  const handleScale = ((compact ? 44 : 32) * VIEW) / (68 * Math.max(renderSize, 1));
  const ordered = useMemo(
    () => [
      ...layers.filter((l) => !selectedIds.includes(l.id)),
      ...layers.filter((l) => selectedIds.includes(l.id)),
    ],
    [layers, selectedIds]
  );

  // Hit targets and handles, as one flat list so the topmost element is simply
  // the last one. A group's grab area sits under its members (tapping an element
  // still resolves to that element) while its frame and handles sit above them.
  const overlayChildren: React.ReactNode[] = [];
  if (interactionMode === "select" && multi && frame) {
    overlayChildren.push(
      <rect
        key="group-grab"
        data-group-hit
        x={frame.x - 8}
        y={frame.y - 8}
        width={Math.max(1, frame.w + 16)}
        height={Math.max(1, frame.h + 16)}
        fill="transparent"
        style={{ cursor: "move" }}
        onPointerDown={(e) => startDrag(e, picked[0], "move")}
      />
    );
  }
  if (interactionMode === "select") {
    for (const layer of ordered) {
      overlayChildren.push(
        <LayerOverlay
          key={layer.id}
          layer={layer}
          area={area}
          areaOrigin={areaOrigin}
          selected={selectedIds.includes(layer.id)}
          solo={!multi && selectedIds.includes(layer.id)}
          compact={compact}
          handleScale={handleScale}
          onPointerDown={startDrag}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      );
    }
  }
  if (interactionMode === "select" && multi && frame) {
    overlayChildren.push(
      <GroupFrame
        key="group-frame"
        frame={frame}
        locked={picked.every((l) => l.locked)}
        compact={compact}
        handleScale={handleScale}
        onGesture={(e, tool, edge) => startDrag(e, picked[0], tool, edge ?? null)}
        onDelete={() => onDelete(picked.map((l) => l.id))}
        onUngroup={onUngroup ? () => onUngroup(picked.map((l) => l.id)) : undefined}
      />
    );
  }

  return (
    <div className="rot-canvas" style={style}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className={`rot-canvas-svg is-${interactionMode}`}
        role="img"
        aria-label={`${side} preview with ${layers.length} design element${layers.length === 1 ? "" : "s"}`}
        onPointerDown={() => {
          if (interactionMode === "select" && !dragRef.current) onSelect([]);
        }}
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

        {dragging === "move" && layers.filter((layer) => layer.id === selectedIds[0]).map((layer) => (
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
          {overlayChildren}
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
  solo,
  compact,
  handleScale,
  onPointerDown,
  onDelete,
  onEdit,
}: {
  layer: DesignLayer;
  area: { w: number; h: number };
  areaOrigin: { x: number; y: number };
  /** The layer is part of the current selection. */
  selected: boolean;
  /** The layer is selected on its own, so it owns the handles. */
  solo: boolean;
  compact: boolean;
  handleScale: number;
  onPointerDown: (e: ReactPointerEvent, layer: DesignLayer, tool: Tool, edge?: Edge | null) => void;
  onDelete: (ids: string[]) => void;
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

      {/* A member of a group gets a quiet outline so it is obvious what the
          group contains, without competing with the group's own handles. */}
      {selected && !solo ? (
        <rect
          x={-halfW}
          y={-halfH}
          width={box.w}
          height={box.h}
          fill="none"
          stroke="#2f7bff"
          strokeOpacity={0.4}
          strokeWidth={1.5}
          pointerEvents="none"
        />
      ) : null}

      {solo ? (
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
            scale={handleScale}
            onActivate={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete([layer.id]);
            }}
          >
            <TrashIcon />
          </ControlButton>

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

          <ControlButton
            x={-halfW - GAP}
            y={halfH + GAP}
            label={isText ? "Edit text" : "Edit artwork"}
            scale={handleScale}
            onActivate={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(layer.id);
            }}
          >
            <EditIcon />
          </ControlButton>
        </>
      ) : null}
    </g>
  );
}

/**
 * The single frame drawn around a group (or any multi-selection). It shows what
 * is grouped, offers the same resize/rotate/stretch grips as a single layer, and
 * swaps the "edit" button for "ungroup".
 */
function GroupFrame({
  frame,
  locked,
  compact,
  handleScale,
  onGesture,
  onDelete,
  onUngroup,
}: {
  frame: { x: number; y: number; w: number; h: number; cx: number; cy: number };
  locked: boolean;
  compact: boolean;
  handleScale: number;
  onGesture: (e: ReactPointerEvent, tool: Tool, edge?: Edge | null) => void;
  onDelete: () => void;
  onUngroup?: () => void;
}) {
  const halfW = frame.w / 2;
  const halfH = frame.h / 2;
  const GAP = 44 * handleScale;
  const margin = 42 * handleScale;
  const rx = halfW + GAP;
  const ry = halfH + GAP;
  const resizeX = clamp(frame.cx + rx, margin, VIEW - margin) - frame.cx;
  const resizeY = clamp(frame.cy + ry, margin, VIEW - margin) - frame.cy;

  return (
    <g transform={`translate(${frame.cx} ${frame.cy})`}>
      <rect
        x={-halfW}
        y={-halfH}
        width={frame.w}
        height={frame.h}
        fill="none"
        stroke="#2f7bff"
        strokeWidth="2.5"
        strokeDasharray="8 6"
        pointerEvents="none"
        data-group-frame
      />

      <ControlButton
        x={-halfW - GAP}
        y={-halfH - GAP}
        label="Delete selected elements"
        scale={handleScale}
        onActivate={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
      >
        <TrashIcon />
      </ControlButton>

      {!locked ? (
        <>
          {!compact ? (
            <>
              <ControlButton
                x={0}
                y={-halfH - GAP}
                label="Stretch group vertically"
                scale={handleScale}
                shape="pill"
                onActivate={(e) => onGesture(e, "scale", "n")}
              >
                <StretchIcon axis="v" />
              </ControlButton>

              <ControlButton
                x={halfW + GAP}
                y={-halfH - GAP}
                label="Rotate group"
                scale={handleScale}
                onActivate={(e) => onGesture(e, "rotate")}
              >
                <RotateIcon />
              </ControlButton>

              <ControlButton
                x={halfW + GAP}
                y={0}
                label="Stretch group horizontally"
                scale={handleScale}
                shape="pill"
                onActivate={(e) => onGesture(e, "scale", "e")}
              >
                <StretchIcon axis="h" />
              </ControlButton>
            </>
          ) : null}

          <ControlButton
            x={resizeX}
            y={resizeY}
            label="Resize group"
            scale={handleScale}
            onActivate={(e) => onGesture(e, "scale", "se")}
          >
            <ScaleIcon />
          </ControlButton>
        </>
      ) : null}

      {onUngroup ? (
        <ControlButton
          x={-halfW - GAP}
          y={halfH + GAP}
          label="Ungroup"
          scale={handleScale}
          onActivate={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onUngroup();
          }}
        >
          <UngroupIcon />
        </ControlButton>
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

function EditIcon() {
  return (
    <Icon>
      <path d="m4 16.5-.8 4.3 4.3-.8L19.8 7.7a2.5 2.5 0 0 0-3.5-3.5L4 16.5Z" />
      <path d="m14.8 5.7 3.5 3.5" />
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

function UngroupIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="11" height="11" rx="1.5" />
      <path d="M14 10h4a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-1" />
    </Icon>
  );
}
