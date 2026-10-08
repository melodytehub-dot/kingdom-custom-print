// Keep stage coordinates stable while layers move; selection must not pan the camera.
export function fitStage(width: number, height: number, zoom = 1) {
  if (width <= 0 || height <= 0) return { size: 0, left: 0, ty: 0 };
  const portraitPhone = width <= 900 && height > width;
  const fit = portraitPhone
    ? Math.min(width * 1.4, height - 24)
    : Math.min(width - 24, height - 24);
  const size = Math.max(0, fit) * zoom;
  return { size, left: (width - size) / 2, ty: (height - size) / 2 };
}
