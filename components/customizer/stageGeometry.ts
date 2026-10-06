// Keep stage coordinates stable while layers move; selection must not pan the camera.
export function fitStage(width: number, height: number, zoom = 1) {
  if (width <= 0 || height <= 0) return { size: 0, left: 0, ty: 0 };
  const size = Math.max(0, Math.min(width - 24, height - 24)) * zoom;
  return { size, left: (width - size) / 2, ty: (height - size) / 2 };
}
