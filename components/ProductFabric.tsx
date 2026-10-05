"use client";

import { useEffect, useRef } from "react";

type Fabric = { width: number; height: number; pixels: Uint8ClampedArray; alpha: Uint8ClampedArray };
const fabrics = new Map<string, Promise<Fabric>>();

function recoverBrightFabricEdges(pixels: Uint8ClampedArray, alpha: Uint8ClampedArray, width: number, height: number) {
  const stride = width + 1;
  const integral = new Uint32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += alpha[y * width + x] > 20 ? 1 : 0;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  const radius = 12;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = (y * width + x) * 4;
      const hi = Math.max(pixels[pixel], pixels[pixel + 1], pixels[pixel + 2]);
      const lo = Math.min(pixels[pixel], pixels[pixel + 1], pixels[pixel + 2]);
      if (y < height * 0.12) {
        if (hi - lo >= 35) alpha[y * width + x] = 0;
        continue;
      }
      if (alpha[y * width + x] > 20) continue;
      const luminance = (pixels[pixel] + pixels[pixel + 1] + pixels[pixel + 2]) / 3;
      const brightTrim = hi - lo < 35 && luminance >= 235;
      if (!brightTrim) continue;
      const edgeRadius = radius;
      const left = Math.max(0, x - edgeRadius), right = Math.min(width - 1, x + edgeRadius);
      const top = Math.max(0, y - edgeRadius), bottom = Math.min(height - 1, y + edgeRadius);
      const nearby = integral[(bottom + 1) * stride + right + 1] - integral[top * stride + right + 1] - integral[(bottom + 1) * stride + left] + integral[top * stride + left];
      if (nearby > 0) alpha[y * width + x] = 255;
    }
  }
}

/** Native vector outlines register the visible fabric to the unmodified photo. */
function loadFabric(family: string): Promise<Fabric> {
  const cached = fabrics.get(family);
  if (cached) return cached;
  const pending = new Promise<Fabric>((resolve, reject) => {
    const load = (src: string) => new Promise<HTMLImageElement>((done, fail) => {
      const image = new window.Image();
      image.onload = () => done(image);
      image.onerror = () => fail(new Error("Photo unavailable"));
      image.src = src;
    });
    Promise.all([
      load(`/_next/image?url=${encodeURIComponent(`/img/catalog-models/${family}.png`)}&w=1920&q=75`),
      load(`/_next/image?url=${encodeURIComponent(`/img/catalog-models/${family}-mask.png`)}&w=1920&q=75`),
    ]).then(([photo, matte]) => {
      const canvas = document.createElement("canvas");
      canvas.width = photo.naturalWidth; canvas.height = photo.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(photo, 0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(matte, 0, 0, canvas.width, canvas.height);
      const mask = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
      for (let p = 0; p < alpha.length; p++) alpha[p] = mask[p * 4 + 3];
      recoverBrightFabricEdges(pixels, alpha, canvas.width, canvas.height);
      resolve({ width: canvas.width, height: canvas.height, pixels, alpha });
    }).catch(reject);
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
