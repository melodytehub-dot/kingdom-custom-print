import Link from "next/link";
import Image from "next/image";
import HeroImageSlider from "@/components/HeroImageSlider";
import HomeProducts from "@/components/HomeProducts";
import DesignStory from "@/components/DesignStory";
import ResumeDesignPrompt from "@/components/ResumeDesignPrompt";
import ArrowRight from "@/components/icons/ArrowRight";
import { getProducts, getSettings, DEFAULT_SETTINGS } from "@/lib/catalog";
import { heroImage } from "@/lib/hero-slides";

export const revalidate = 60;

const categories = [
  { name: "Shirts", href: "/shop?kind=tee", image: "/img/category-prints/shirts.webp" },
  { name: "Polos", href: "/shop?kind=polo", image: "/img/category-prints/polos.webp" },
  { name: "Long sleeves", href: "/shop?kind=longsleeve", image: "/img/category-prints/long-sleeves.webp" },
  { name: "Hoodies", href: "/shop?kind=fleece", image: "/img/category-prints/hoodies.webp" },
  { name: "Caps", href: "/shop?kind=cap", image: "/img/category-prints/caps.webp" },
  { name: "Totes", href: "/shop?kind=tote", image: "/img/category-prints/totes.webp" },
  { name: "Merch", href: "/shop?kind=mug", image: "/img/category-prints/merch.webp" },
];

// Keep mixed-case content entered by the store owner unchanged.
function displayTitle(value: string) {
  return /[A-Z]/.test(value) && value === value.toUpperCase()
    ? value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    : value;
}

export default async function HomePage() {
  const [products, settings] = await Promise.all([getProducts().catch(() => []), getSettings().catch(() => DEFAULT_SETTINGS)]);
  return (
    <div className="kcp-home">
      <ResumeDesignPrompt />
      <section className="kcp-hero" aria-labelledby="home-title">
        <div className="kcp-hero-image"><HeroImageSlider slides={[heroImage(settings.heroImage1), heroImage(settings.heroImage2), heroImage(settings.heroImage3)]} /></div>
        <div className="kcp-hero-shade" aria-hidden="true" />
        <div className="kcp-wrap kcp-hero-content">
          <span className="kcp-eyebrow kcp-eyebrow-light"><span aria-hidden="true" />{displayTitle(settings.heroLabel)}</span>
          <h1 id="home-title">{displayTitle(settings.heroHeadlineTop)}<br />{displayTitle(settings.heroHeadlineBottom)}</h1>
          <p>{settings.heroDescription}</p>
        </div>
      </section>
      <div className="kcp-hero-actions kcp-wrap">
        <Link href="/shop" className="kcp-button kcp-button-dark">Shop now <ArrowRight size={17} /></Link>
        <Link href="/customize" className="kcp-button kcp-button-outline">Design your own <ArrowRight size={17} /></Link>
      </div>

      <section className="kcp-categories kcp-wrap" aria-label="Shop by category">
        <nav className="kcp-category-grid" aria-label="Shop by category">
          {categories.map(category => <Link key={category.name} href={category.href} className="kcp-category"><span className="kcp-category-image"><Image src={category.image} alt="" fill sizes="(max-width: 600px) 42vw, 14vw" /></span><span>{category.name}<ArrowRight size={15} /></span></Link>)}
        </nav>
      </section>

      <DesignStory />

      <section className="kcp-products" aria-labelledby="products-title"><div className="kcp-wrap">
        <div className="kcp-heading kcp-products-heading"><div><span className="kcp-eyebrow">Made for Your Ideas</span><h2 id="products-title">{displayTitle(settings.homeProductsTitle)}</h2><p>{settings.homeProductsDescription}</p></div><Link href="/shop" className="kcp-text-link">View all products <ArrowRight size={17} /></Link></div>
        <HomeProducts products={products} />
      </div></section>

      <section className="kcp-project kcp-wrap" aria-labelledby="project-title">
        <div className="kcp-project-intro"><span className="kcp-eyebrow">Your Idea, Your Way</span><h2 id="project-title">Make it personal.<br /><em>Make it yours.</em></h2><p>Design something for yourself, or tell us what you need for your team, event or business.</p></div>
        <div className="kcp-project-grid">
          <Link href="/customize" className="kcp-project-card"><span className="kcp-project-copy"><small>Create Your Own</small><strong>Design online</strong><span>Start designing <ArrowRight size={16} /></span></span><span className="kcp-project-image"><Image src="/img/category-prints/shirts.webp" alt="" fill sizes="(max-width: 700px) 48vw, 30vw" /></span></Link>
          <Link href="/contact" className="kcp-project-card"><span className="kcp-project-copy"><small>For Teams & Events</small><strong>Plan a group order</strong><span>Request a quote <ArrowRight size={16} /></span></span><span className="kcp-project-image"><Image src="/img/category-prints/hoodies.webp" alt="" fill sizes="(max-width: 700px) 48vw, 30vw" /></span></Link>
        </div>
      </section>

      <section className="kcp-process" aria-labelledby="process-title"><div className="kcp-wrap kcp-process-inner">
        <div><span className="kcp-eyebrow kcp-eyebrow-light">From Idea to Apparel</span><h2 id="process-title">Made for the things<br /><em>that matter to you.</em></h2><p>From a favorite tee to gear for your whole team, create something that feels like yours.</p><Link href="/customize" className="kcp-button kcp-button-light">Open the design studio <ArrowRight size={17} /></Link></div>
        <ol className="kcp-process-steps"><li><span>01</span><div><strong>Choose a product</strong><p>Find the garment, color and sizes that fit your idea.</p></div></li><li><span>02</span><div><strong>Make it yours</strong><p>Add your artwork, text or a design in the studio.</p></div></li><li><span>03</span><div><strong>Review and order</strong><p>Check your design and quantities before checkout.</p></div></li></ol>
      </div></section>

      <section className="kcp-questions" aria-labelledby="questions-title"><div className="kcp-wrap kcp-questions-inner">
        <div><span className="kcp-eyebrow">Here to Help</span><h2 id="questions-title">Good questions.<br /><em>Clear answers.</em></h2><p>Everything you need to get started with your custom order.</p><Link href="/faq" className="kcp-text-link">See all questions <ArrowRight size={17} /></Link></div>
        <div className="kcp-faq-list">
          <details><summary>What can I add to a design?<span aria-hidden="true">+</span></summary><p>You can add text, choose graphics or upload your own artwork in the design studio.</p></details>
          <details><summary>Can I see my design before I order?<span aria-hidden="true">+</span></summary><p>Yes. The studio lets you preview your design and review its placement before checkout.</p></details>
          <details><summary>Need help with a group order?<span aria-hidden="true">+</span></summary><p>Tell us about your project and we can help you plan your order. <Link href="/contact">Get in touch</Link>.</p></details>
        </div>
      </div></section>

      <section className="kcp-contact kcp-wrap"><div><span className="kcp-eyebrow">Let&apos;s Make Something</span><h2>{displayTitle(settings.homeContactTitle)}</h2><p>{settings.homeContactDescription}</p></div><Link href="/contact" className="kcp-button kcp-button-dark">Get in touch <ArrowRight size={17} /></Link></section>
    </div>
  );
}
