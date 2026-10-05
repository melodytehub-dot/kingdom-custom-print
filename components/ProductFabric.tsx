"use client";

import { useEffect, useRef } from "react";
import contours from "@/lib/photo-contours.json";

type Fabric = { width: number; height: number; pixels: Uint8ClampedArray; alpha: Uint8ClampedArray };
const fabrics = new Map<string, Promise<Fabric>>();

/** Native vector outlines register the visible fabric to the unmodified photo. */
function loadFabric(family: string): Promise<Fabric> {
  const cached = fabrics.get(family);
  if (cached) return cached;
  const pending = new Promise<Fabric>((resolve, reject) => {
    const photo = new window.Image();
    photo.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = photo.naturalWidth; canvas.height = photo.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(photo, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(canvas.width / 2172, canvas.height / 724);
      ctx.fillStyle = "#fff";
      for (let panel = 0; panel < 3; panel++) {
        ctx.save();
        ctx.translate(panel * 724, 0);
        ctx.fill(new Path2D(contours[family as keyof typeof contours][panel]), "evenodd");
        ctx.restore();
      }
      const mask = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
      for (let p = 0; p < alpha.length; p++) alpha[p] = mask[p * 4 + 3];
      resolve({ width: canvas.width, height: canvas.height, pixels, alpha });
    };
    photo.onerror = () => reject(new Error("Photo unavailable"));
    photo.src = `/_next/image?url=${encodeURIComponent(`/img/catalog-models/${family}.png`)}&w=1920&q=75`;
  });
  fabrics.set(family, pending);
  pending.catch(() => fabrics.delete(family));
  return pending;
}

export default function ProductFabric({ family, color, index }: { family: string; color: string; index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let canceled = false;
    if (ref.current) { ref.current.dataset.ready = "false"; delete ref.current.dataset.failed; }
    const draw = () => loadFabric(family).then(fabric => {
      if (canceled || !ref.current) return;
      const canvas = ref.current;
      canvas.width = fabric.width; canvas.height = fabric.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rgb = color.replace("#", "").match(/../g)?.map(c => parseInt(c, 16)) ?? [255, 255, 255];
      const output = ctx.createImageData(fabric.width, fabric.height);
      for (let p = 0; p < fabric.alpha.length; p++) {
        const i = p * 4;
        for (let c = 0; c < 3; c++) output.data[i + c] = fabric.pixels[i + c] * rgb[c] / 255;
        output.data[i + 3] = fabric.alpha[p];
      }
      ctx.putImageData(output, 0, 0);
      canvas.dataset.ready = "true";
      canvas.dataset.color = color;
    }).catch(() => {
      if (!canceled && ref.current) ref.current.dataset.failed = "true";
    });
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); void draw(); }
    }, { rootMargin: "240px" });
    if (ref.current?.parentElement) observer.observe(ref.current.parentElement);
    return () => { canceled = true; observer.disconnect(); };
  }, [family, color]);
  return <canvas ref={ref} className="product-fabric-canvas" aria-hidden="true" style={{ left: `${-index * 100}%` }} />;
}
