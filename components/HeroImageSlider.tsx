"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";

const SLIDES = [
  {
    src: "/img/shop-studio.png",
    alt: "Kingdom Custom Print studio with a custom printed shirt",
    name: "Print studio",
    position: "center",
  },
  {
    src: "/img/shop-printing.png",
    alt: "A custom graphic being printed on a shirt in the studio",
    name: "Custom printing",
    position: "center",
  },
  {
    src: "/img/kingdom-team.webp",
    alt: "A team wearing Kingdom Custom Print shirts",
    name: "Kingdom team",
    position: "center top",
  },
];

export default function HeroImageSlider() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const swipeStart = useRef<{ id: number; x: number } | null>(null);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreferences = () => {
      setIsMobile(mobileQuery.matches);
      setReducedMotion(motionQuery.matches);
    };
    syncPreferences();
    mobileQuery.addEventListener("change", syncPreferences);
    motionQuery.addEventListener("change", syncPreferences);
    return () => {
      mobileQuery.removeEventListener("change", syncPreferences);
      motionQuery.removeEventListener("change", syncPreferences);
    };
  }, []);

  useEffect(() => {
    const syncVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    if (!isMobile || reducedMotion || paused || hovered || focused || !pageVisible) return;
    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % SLIDES.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [focused, hovered, isMobile, pageVisible, paused, reducedMotion]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isMobile || (event.pointerType !== "touch" && event.pointerType !== "pen")) return;
    if ((event.target as HTMLElement).closest("button")) return;
    swipeStart.current = { id: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start || start.id !== event.pointerId) return;
    swipeStart.current = null;
    const difference = event.clientX - start.x;
    if (Math.abs(difference) < 40) return;
    setActiveSlide((current) => (current + (difference < 0 ? 1 : -1) + SLIDES.length) % SLIDES.length);
  };

  return (
    <div
      className="mm-hero-img-wrap mm-hero-slider"
      role="region"
      aria-label="Featured Kingdom Custom Print photos"
      aria-roledescription="carousel"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { swipeStart.current = null; }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
      onFocusCapture={(event) => setFocused(event.target instanceof HTMLElement && event.target.matches(":focus-visible"))}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div className={`mm-hero-slider-track${isMobile ? " is-mobile" : ""}`} style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
        {SLIDES.map((slide, index) => (
          <div
            key={slide.src}
            className="mm-hero-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${SLIDES.length}: ${slide.name}`}
            aria-hidden={activeSlide !== index}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="(max-width: 768px) calc(100vw - 36px), 520px"
              priority={index === 0}
              style={{ objectFit: "cover", objectPosition: slide.position }}
            />
          </div>
        ))}
      </div>

      {isMobile ? (
        <div className="mm-hero-slider-controls" role="group" aria-label="Choose a featured photo">
          <div className="mm-hero-slider-dots">
            {SLIDES.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                className={`mm-hero-slider-dot${activeSlide === index ? " is-active" : ""}`}
                aria-label={`Show photo ${index + 1}: ${slide.name}`}
                aria-pressed={activeSlide === index}
                onClick={() => setActiveSlide(index)}
              />
            ))}
          </div>
          {!reducedMotion ? (
            <button
              type="button"
              className="mm-hero-slider-toggle"
              aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
              onClick={() => setPaused((current) => !current)}
            >
              <span className={paused ? "is-play" : "is-pause"} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
