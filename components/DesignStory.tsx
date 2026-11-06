"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ArrowRight from "@/components/icons/ArrowRight";

const steps = [
  { label: "The blank", image: "/img/printed-catalog/crown-classic-tee/black.webp", title: "Choose your canvas", text: "Start with a garment, then choose the color and sizes that suit your idea." },
  { label: "Your design", image: "/img/category-prints/shirts.webp", title: "Make it your own", text: "Add text, graphics or your own artwork, and see how it looks in the design studio." },
] as const;

export default function DesignStory() {
  const [active, setActive] = useState(0);
  const current = steps[active];
  return (
    <section className="kcp-story" aria-labelledby="story-title">
      <div className="kcp-wrap">
        <div className="kcp-story-heading" data-reveal>
          <span className="kcp-eyebrow">Your Idea, on a Shirt</span>
          <h2 id="story-title">A little imagination.<br /><em>A lot of possibilities.</em></h2>
          <p>Start with a blank and make it yours, right here in the design studio.</p>
        </div>
        <div className="kcp-story-card" data-reveal>
          <div className="kcp-story-visual">
            <div className="kcp-story-image" key={current.image}><Image src={current.image} alt={active ? "Black shirt with an example design" : "Blank black shirt"} fill sizes="(max-width: 768px) 80vw, 500px" /></div>
          </div>
          <div className="kcp-story-copy">
            <div className="kcp-story-switch" role="group" aria-label="Explore the design process">
              {steps.map((step, i) => <button key={step.label} type="button" aria-pressed={active === i} onClick={() => setActive(i)}>{step.label}</button>)}
            </div>
            <span className="kcp-eyebrow">0{active + 1} / 02</span>
            <h3>{current.title}</h3><p>{current.text}</p>
            <Link href="/customize" className="kcp-button kcp-button-dark">Try the design studio <ArrowRight size={17} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
