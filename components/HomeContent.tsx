import Link from "next/link";
import Image from "next/image";
import HeroImageSlider from "@/components/HeroImageSlider";
import HomeProducts from "@/components/HomeProducts";
import ProductCard from "@/components/ProductCard";
import ResumeDesignPrompt from "@/components/ResumeDesignPrompt";
import ArrowRight from "@/components/icons/ArrowRight";
import { getProducts, getSettings, DEFAULT_SETTINGS } from "@/lib/catalog";
import { heroImage } from "@/lib/hero-slides";
import { DEFAULT_DESIGN_BANNER, DEFAULT_HERO_ACTIONS, DEFAULT_HOMEPAGE_QUESTIONS, type HomepageLayout } from "@/lib/homepage-builder";
import { HomepageSection, HomeSectionOrder } from "@/components/HomeSectionOrder";


const categories = [
  { name: "Shirts", href: "/shop?kind=tee", image: "/img/category-prints/shirts.webp" },
  { name: "Polos", href: "/shop?kind=polo", image: "/img/category-prints/polos.webp" },
  { name: "Long sleeves", href: "/shop?kind=longsleeve", image: "/img/category-prints/long-sleeves.webp" },
  { name: "Hoodies", href: "/shop?kind=fleece", image: "/img/category-prints/hoodies.webp" },
  { name: "Caps", href: "/shop?kind=cap", image: "/img/category-prints/caps.webp" },
  { name: "Totes", href: "/shop?kind=tote", image: "/img/category-prints/totes.webp" },
  { name: "Merch", href: "/shop?kind=mug", image: "/img/category-prints/merch.webp" },
  { name: "Active Wear", href: "/product/performance-tee", image: "/img/category-prints/active-wear.webp" },
];

// Keep mixed-case content entered by the store owner unchanged.
function displayTitle(value: string) {
  return /[A-Z]/.test(value) && value === value.toUpperCase()
    ? value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    : value;
}

export default async function HomeContent({ layout, preview = false }: { layout: HomepageLayout; preview?: boolean }) {
  const [products, liveSettings] = await Promise.all([getProducts().catch(() => []), getSettings().catch(() => DEFAULT_SETTINGS)]);
  const settings = preview && layout.content ? { ...liveSettings, ...layout.content } : liveSettings;
  const banner = layout.designBanner ?? DEFAULT_DESIGN_BANNER;
  const actions = layout.heroActions ?? DEFAULT_HERO_ACTIONS;
  const questions = layout.questionsContent ?? DEFAULT_HOMEPAGE_QUESTIONS;
  const readyToShip = products.filter(product => product.saleMode === "ready-made" && product.featured).slice(0, 4);
  const featuredBlanks = products.filter(product => product.saleMode !== "ready-made" && product.featured);
  const featuredProducts = [...new Set([
    ...["tee", "polo", "hoodie", "cap", "crew", "tote", "mug", "longsleeve"].map(kind => featuredBlanks.find(product => product.kind === kind)).filter(product => product !== undefined),
    ...featuredBlanks,
  ])].slice(0, 4);
  const shownIds = new Set([...(layout.hiddenSections?.includes("ready-to-ship") ? [] : readyToShip), ...(layout.hiddenSections?.includes("featured-products") ? [] : featuredProducts)].map(product => product.id));
  const samples = [categories[0], categories[1], categories[3], categories[5]];
  return (
    <div className="kcp-home">
      {!preview ? <ResumeDesignPrompt /> : null}
      {preview ? <div hidden data-home-preview-products>{products.map(product => <div key={product.id} data-home-product-id={product.id}><ProductCard product={product} /></div>)}</div> : null}
      <HomeSectionOrder layout={layout} preview={preview} products={products}>
      <HomepageSection id="hero">
      <section className="kcp-hero" aria-labelledby="home-title" data-home-section="hero">
        <div className="kcp-hero-image"><HeroImageSlider slides={[heroImage(settings.heroImage1), heroImage(settings.heroImage2), heroImage(settings.heroImage3)]} /></div>
        <div className="kcp-hero-shade" aria-hidden="true" />
        <div className="kcp-wrap kcp-hero-content">
          <span className="kcp-eyebrow kcp-eyebrow-light"><span aria-hidden="true" /><strong data-home-field="heroLabel" style={{ fontWeight: "inherit" }}>{displayTitle(settings.heroLabel)}</strong></span>
          <h1 id="home-title"><span data-home-field="heroHeadlineTop">{displayTitle(settings.heroHeadlineTop)}</span><br /><span data-home-field="heroHeadlineBottom">{displayTitle(settings.heroHeadlineBottom)}</span></h1>
          <p data-home-field="heroDescription">{settings.heroDescription}</p>
        </div>
      </section>
      </HomepageSection>

      <HomepageSection id="hero-actions">
      <div className="kcp-hero-actions kcp-wrap" data-home-section="hero-actions">
        <Link href={actions.primaryLink} className="kcp-button kcp-button-dark" data-home-hero-link="primary"><span data-home-hero-action="primaryText">{actions.primaryText}</span> <ArrowRight size={17} /></Link>
        <Link href={actions.secondaryLink} className="kcp-button kcp-button-outline" data-home-hero-link="secondary"><span data-home-hero-action="secondaryText">{actions.secondaryText}</span> <ArrowRight size={17} /></Link>
      </div>
      </HomepageSection>

      <HomepageSection id="category-strip">
      <nav className="kcp-category-strip kcp-wrap" aria-label="Browse product categories" data-home-section="category-strip">
        {categories.map(category => <Link key={category.name} href={category.href}><span><Image src={category.image} alt="" fill sizes="80px" /></span><small>{category.name}</small></Link>)}
      </nav>
      </HomepageSection>

      <HomepageSection id="ready-to-ship">
      <section className="kcp-featured kcp-wrap" aria-labelledby="ready-title" data-home-section="ready-to-ship">
        <div className="kcp-heading"><div><span className="kcp-eyebrow">Shop the collection</span><h2 id="ready-title">Ready to ship</h2></div><Link href="/shop" className="kcp-text-link">View all products <ArrowRight size={17} /></Link></div>
        {readyToShip.length ? <ul className="mm-product-grid">{readyToShip.map(product => <li key={product.id}><ProductCard product={product} /></li>)}</ul> : <><p className="kcp-sample-note">Ready-to-ship products are coming soon. These are sample previews.</p><div className="kcp-sample-grid">{samples.map(item => <div className="kcp-sample-card" key={item.name}><span className="kcp-sample-image"><Image src={item.image} alt="" fill sizes="(max-width: 768px) 45vw, 23vw" /></span><strong>{item.name}</strong><small>Sample · Not for sale</small></div>)}</div></>}
      </section>
      </HomepageSection>

      <HomepageSection id="featured-products">
      {featuredProducts.length > 0 && <section className="kcp-featured kcp-wrap" aria-labelledby="featured-title" data-home-section="featured-products">
        <div className="kcp-heading"><div><span className="kcp-eyebrow">Made for your ideas</span><h2 id="featured-title">Featured products</h2></div><Link href="/shop" className="kcp-text-link">View all products <ArrowRight size={17} /></Link></div>
        <ul className="mm-product-grid">{featuredProducts.map(product => <li key={product.id}><ProductCard product={product} /></li>)}</ul>
      </section>}
      </HomepageSection>

      <HomepageSection id="design-banner">
      <section className="kcp-feature-banner kcp-wrap" aria-label="Start a custom design" data-home-section="design-banner">
        <div className="kcp-collection-banner"><div className="kcp-collection-copy"><span className="kcp-eyebrow" data-home-banner="eyebrow">{banner.eyebrow}</span><h2 data-home-banner="heading">{banner.heading}</h2><p data-home-banner="description">{banner.description}</p><Link href={banner.buttonLink} className="kcp-collection-link" data-home-banner-link><span data-home-banner="buttonText">{banner.buttonText}</span> <ArrowRight size={16} /></Link></div><div className="kcp-collection-image"><Image src="/img/category-prints/shirts.webp" alt="" fill sizes="(max-width: 768px) 45vw, 420px" /></div></div>
      </section>
      </HomepageSection>

      <HomepageSection id="categories">
      <section className="kcp-categories kcp-wrap" aria-label="Shop by category" data-home-section="categories">
        <nav className="kcp-category-grid" aria-label="Shop by category">
          {categories.map(category => <Link key={category.name} href={category.href} className="kcp-category"><span className="kcp-category-image"><Image src={category.image} alt="" fill sizes="(max-width: 600px) 42vw, 14vw" /></span><span>{category.name}<ArrowRight size={15} /></span></Link>)}
        </nav>
      </section>
      </HomepageSection>

      <HomepageSection id="products">
      <section className="kcp-products" aria-labelledby="products-title" data-home-section="products"><div className="kcp-wrap">
        <div className="kcp-heading kcp-products-heading"><div><span className="kcp-eyebrow">Made for Your Ideas</span><h2 id="products-title" data-home-field="homeProductsTitle">{displayTitle(settings.homeProductsTitle)}</h2><p data-home-field="homeProductsDescription">{settings.homeProductsDescription}</p></div><Link href="/shop" className="kcp-text-link">View all products <ArrowRight size={17} /></Link></div>
        <HomeProducts products={products.filter(product => !shownIds.has(product.id))} />
      </div></section>
      </HomepageSection>

      <HomepageSection id="projects">
      <section className="kcp-project kcp-wrap" aria-labelledby="project-title" data-home-section="projects">
        <div className="kcp-project-intro"><span className="kcp-eyebrow">Your Idea, Your Way</span><h2 id="project-title">Make it personal.<br /><em>Make it yours.</em></h2><p>Design something for yourself, or tell us what you need for your team, event or business.</p></div>
        <div className="kcp-project-grid">
          <Link href="/customize" className="kcp-project-card"><span className="kcp-project-copy"><small>Create Your Own</small><strong>Design online</strong><span>Start designing <ArrowRight size={16} /></span></span><span className="kcp-project-image"><Image src="/img/category-prints/shirts.webp" alt="" fill sizes="(max-width: 700px) 48vw, 30vw" /></span></Link>
          <Link href="/contact" className="kcp-project-card"><span className="kcp-project-copy"><small>For Teams & Events</small><strong>Plan a group order</strong><span>Request a quote <ArrowRight size={16} /></span></span><span className="kcp-project-image"><Image src="/img/category-prints/hoodies.webp" alt="" fill sizes="(max-width: 700px) 48vw, 30vw" /></span></Link>
        </div>
      </section>
      </HomepageSection>

      <HomepageSection id="process">
      <section className="kcp-process" aria-labelledby="process-title" data-home-section="process"><div className="kcp-wrap kcp-process-inner">
        <div><span className="kcp-eyebrow kcp-eyebrow-light">From Idea to Apparel</span><h2 id="process-title">Made for the things<br /><em>that matter to you.</em></h2><p>From a favorite tee to gear for your whole team, create something that feels like yours.</p><Link href="/customize" className="kcp-button kcp-button-light">Open the design studio <ArrowRight size={17} /></Link></div>
        <ol className="kcp-process-steps"><li><span>01</span><div><strong>Choose a product</strong><p>Find the garment, color and sizes that fit your idea.</p></div></li><li><span>02</span><div><strong>Make it yours</strong><p>Add your artwork, text or a design in the studio.</p></div></li><li><span>03</span><div><strong>Review and order</strong><p>Check your design and quantities before checkout.</p></div></li></ol>
      </div></section>
      </HomepageSection>

      <HomepageSection id="questions">
      <section className="kcp-questions" aria-labelledby="questions-title" data-home-section="questions"><div className="kcp-wrap kcp-questions-inner">
        <div><span className="kcp-eyebrow">Here to Help</span><h2 id="questions-title"><span data-home-questions="titleTop">{questions.titleTop}</span><br /><em data-home-questions="titleBottom">{questions.titleBottom}</em></h2><p data-home-questions="introduction">{questions.introduction}</p><Link href="/faq" className="kcp-text-link">See all questions <ArrowRight size={17} /></Link></div>
        <div className="kcp-faq-list" data-home-questions-list>{questions.items.map((item, index) => <details key={index}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}{item.linkText && item.link ? <> <Link href={item.link}>{item.linkText}</Link>.</> : null}</p></details>)}</div>
      </div></section>
      </HomepageSection>

      <HomepageSection id="contact">
      <section className="kcp-contact kcp-wrap" data-home-section="contact"><div><span className="kcp-eyebrow">Let&apos;s Make Something</span><h2 data-home-field="homeContactTitle">{displayTitle(settings.homeContactTitle)}</h2><p data-home-field="homeContactDescription">{settings.homeContactDescription}</p></div><div className="kcp-spot-action"><Link href="/contact" className="kcp-button kcp-button-dark">Get in touch <ArrowRight size={17} /></Link><span className="kcp-spot-photo"><Image src="/img/loyalty-group.webp" alt="" fill sizes="(max-width: 700px) 42vw, 230px" /></span></div></section>
      </HomepageSection>
      </HomeSectionOrder>
    </div>
  );
}
