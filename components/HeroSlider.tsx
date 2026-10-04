"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

const SLIDES = [
  {
    tag: "THE NEW PRINT-ON-DEMAND ERA",
    title: "CUSTOM PRINT ON DEMAND",
    sub: "Design high-margin custom t-shirts and hoodies online. Zero minimum order sizes, premium retail fabrics, and fast direct-to-garment turnaround.",
    primaryCta: { label: "CUSTOMIZE NOW", href: "/customize" },
    secondaryCta: { label: "EXPLORE BLANKS", href: "/shop" },
    badgeText: "TOP RATED POD",
    badgeRating: "4.9 ★★★★★",
    badgeSub: "Over 10,000+ custom prints shipped",
    imgUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
    imgAlt: "Custom printed apparel showcase",
  },
  {
    tag: "ORGANIC & HEAVYWEIGHT STREETWEAR",
    title: "PREMIUM STREETWEAR EDIT",
    sub: "Heavy 280 GSM combed cotton blanks, dropped shoulder boxy fits, and ultra-durable prints engineered for modern creator brands.",
    primaryCta: { label: "CUSTOMIZE HOODIES", href: "/customize" },
    secondaryCta: { label: "SHOP FLEECE", href: "/shop?kind=hoodie" },
    badgeText: "HEAVYWEIGHT 280 GSM",
    badgeRating: "100% ORGANIC",
    badgeSub: "Zero shrinkage guarantee",
    imgUrl: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
    imgAlt: "Heavyweight streetwear blank apparel",
  },
  {
    tag: "AUTOMATED BULK VOLUME TIERS",
    title: "PRINT FOR TEAMS & BRANDS",
    sub: "Save up to 40% on team orders with transparent tier breaks. Interactive online mockup studio with instant digital proofs and free shipping.",
    primaryCta: { label: "LAUNCH STUDIO", href: "/customize" },
    secondaryCta: { label: "VIEW ALL BLANKS", href: "/shop" },
    badgeText: "BULK DISCOUNTS",
    badgeRating: "UP TO 40% OFF",
    badgeSub: "Tier breaks from 6+ units",
    imgUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=900&q=80",
    imgAlt: "Custom team apparel printing",
  },
];

export default function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [nextSlide, isPaused]);

  const slide = SLIDES[currentSlide];

  return (
    <section
      className="mm-hero"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Featured promotions carousel"
    >
      <div className="minimog-container">
        <div className="mm-hero-grid">
          {/* Hero Left Content */}
          <div className="mm-hero-content">
            <span className="mm-hero-tag">{slide.tag}</span>
            <h1 className="mm-hero-title">{slide.title}</h1>
            <p className="mm-hero-sub">{slide.sub}</p>

            <div className="mm-hero-actions">
              <Link href={slide.primaryCta.href} className="mm-btn mm-btn-primary">
                {slide.primaryCta.label}
              </Link>
              <Link href={slide.secondaryCta.href} className="mm-btn mm-btn-outline">
                {slide.secondaryCta.label}
              </Link>
            </div>

            {/* Slider Dots & Arrows */}
            <div className="mm-hero-nav">
              <div className="mm-hero-dots">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`mm-hero-dot ${i === currentSlide ? "active" : ""}`}
                    onClick={() => setCurrentSlide(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    aria-current={i === currentSlide}
                  />
                ))}
              </div>

              <div className="mm-hero-arrows">
                <button
                  type="button"
                  className="mm-hero-arrow-btn"
                  onClick={prevSlide}
                  aria-label="Previous slide"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="mm-hero-arrow-btn"
                  onClick={nextSlide}
                  aria-label="Next slide"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Hero Right Media */}
          <div className="mm-hero-media">
            <div className="mm-hero-image-wrap">
              <Image
                src={slide.imgUrl}
                alt={slide.imgAlt}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 550px"
                className="mm-hero-img"
              />
            </div>

            <div className="mm-hero-badge-floating">
              <span className="mm-badge-num">{slide.badgeText}</span>
              <span className="mm-badge-label">{slide.badgeRating}</span>
              <span className="mm-badge-stars">{slide.badgeSub}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
