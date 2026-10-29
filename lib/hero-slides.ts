export const HERO_IMAGES = [
  { src: "/img/shop-studio.png", alt: "Kingdom Custom Print studio with a custom printed shirt", name: "Print studio", position: "center" },
  { src: "/img/shop-printing.png", alt: "A custom graphic being printed on a shirt in the studio", name: "Custom printing", position: "center" },
  { src: "/img/kingdom-team.webp", alt: "A team wearing Kingdom Custom Print shirts", name: "Kingdom team", position: "center top" },
] as const;

export function heroImage(src: string) {
  return HERO_IMAGES.find((image) => image.src === src) ?? HERO_IMAGES[0];
}
