import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  resolveSeoImage,
} from "../lib/seo";

import "./neheze-farms.css";

const CANONICAL_PATH = "/neheze-farms";
const HERO_IMAGE = "/assets/neheze-farms/neheze-farms-nursery-hero.png";
const VARIETIES_IMAGE = "/assets/neheze-farms/neheze-farms-plant-varieties.png";
const LOGO_IMAGE = "/assets/neheze-farms/neheze-farms-logo.png";
const FLYER_IMAGE = "/assets/neheze-farms/neheze-farms-original-flyer.jpg";
const PHONE_DISPLAY = "0708 222 3478";
const PHONE_LOCAL = "07082223478";
const PHONE_INTERNATIONAL = "+2347082223478";
const WHATSAPP_NUMBER = "2347082223478";
const ADDRESS =
  "Immediately after Gadan Madugu, before OCP/AGROLOG Fertilizer Store, opposite Upper Customary Court, Kwoi, Jaba LGA, Kaduna State, Nigeria.";

const NAV_ITEMS = [
  { href: "#plants", label: "Plants" },
  { href: "#services", label: "Services" },
  { href: "#about", label: "Our farm" },
  { href: "#visit", label: "Visit us" },
];

const PLANT_GROUPS = [
  {
    name: "Mango",
    eyebrow: "Orchard favourite",
    detail: "Selected varieties, including premium Golden Queen mango seedlings.",
    position: "4%",
  },
  {
    name: "Citrus",
    eyebrow: "Bright & productive",
    detail: "Healthy orange and lemon seedlings for homesteads and orchards.",
    position: "38%",
  },
  {
    name: "Avocado",
    eyebrow: "High-value crop",
    detail: "Strong young plants chosen for confident orchard establishment.",
    position: "69%",
  },
  {
    name: "Papaya & banana",
    eyebrow: "Tropical essentials",
    detail: "Vigorous plants for growers building a diverse fruit harvest.",
    position: "98%",
  },
];

const SERVICES = [
  {
    number: "01",
    title: "Imported seedlings",
    detail:
      "Access highly improved fruit-tree and flower seedlings selected for healthy establishment and dependable growth.",
  },
  {
    number: "02",
    title: "Orchard development",
    detail:
      "Practical support from early site planning and crop selection through planting layout and orchard establishment.",
  },
  {
    number: "03",
    title: "Maintenance & supervision",
    detail:
      "Ongoing guidance that helps young orchards receive the attention, structure, and care they need.",
  },
  {
    number: "04",
    title: "Agro consultancy",
    detail:
      "Clear, experience-led advice for growers, farms, institutions, and anyone planning a productive green project.",
  },
];

const PROCESS = [
  ["Tell us your goal", "Share your land size, location, preferred crops, and planting timeline."],
  ["Choose your seedlings", "We help you match suitable fruit plants to the orchard you want to build."],
  ["Plan the orchard", "Get practical guidance on layout, establishment, care, and supervision."],
  ["Grow with support", "Stay connected as your seedlings settle, strengthen, and begin their journey."],
];

function LeafIcon({ name, size = 20 }) {
  const paths = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    call: (
      <path d="M7.1 3.7 9.3 8 6.8 9.5c1.1 2.4 3.1 4.4 5.5 5.5l1.5-2.5 4.3 2.2-.7 3.5c-.2.9-1 1.6-2 1.6C9.2 19.8 4.2 14.8 4.2 8.6c0-1 .7-1.8 1.6-2l1.3-2.9Z" />
    ),
    map: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    message: (
      <>
        <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4.1A8 8 0 1 1 20 11.5Z" />
        <path d="M8.5 9.3c1 2.5 2.4 3.9 5 5" />
      </>
    ),
    sprout: (
      <>
        <path d="M12 21v-9" />
        <path d="M12 14c-4.8 0-7-2.7-7-7 4.8 0 7 2.7 7 7Z" />
        <path d="M12 11c0-4.8 2.7-7 7-7 0 4.8-2.7 7-7 7Z" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function BrandLogo({ footer = false }) {
  return (
    <a className={`nf-brand${footer ? " nf-brand--footer" : ""}`} href="#home" aria-label="Neheze Farms home">
      <span className="nf-brand__image">
        <img src={LOGO_IMAGE} alt="Neheze Farms Seedlings and Enterprises" />
      </span>
    </a>
  );
}

export default function NehezeFarmsPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState("");
  const [plant, setPlant] = useState("Mango seedlings");
  const [quantity, setQuantity] = useState("10–50");

  const whatsappHref = useMemo(() => {
    const customer = name.trim() || "a prospective customer";
    const message = `Hello Neheze Farms, my name is ${customer}. I am interested in ${plant} (estimated quantity: ${quantity}). Please share availability and next steps.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }, [name, plant, quantity]);

  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;
  const pageDescription =
    "Neheze Farms supplies improved fruit-tree and flower seedlings and provides orchard development, maintenance, supervision, and agro consultancy in Kwoi, Kaduna State.";
  const structuredData = [
    buildWebSiteJsonLd(),
    buildOrganizationJsonLd(),
    buildBreadcrumbJsonLd([
      { name: "Tengacion", url: "/" },
      { name: "Neheze Farms", url: CANONICAL_PATH },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "Neheze Farms, Seedlings and Enterprises",
      alternateName: "Neheze Farms",
      url: buildCanonicalUrl(CANONICAL_PATH),
      image: resolveSeoImage(HERO_IMAGE),
      logo: resolveSeoImage(LOGO_IMAGE),
      description: pageDescription,
      telephone: PHONE_INTERNATIONAL,
      identifier: "BN 2384535",
      address: {
        "@type": "PostalAddress",
        streetAddress:
          "Immediately after Gadan Madugu, before OCP/AGROLOG Fertilizer Store, opposite Upper Customary Court",
        addressLocality: "Kwoi",
        addressRegion: "Kaduna State",
        addressCountry: "NG",
      },
      areaServed: "Kaduna State, Nigeria",
      makesOffer: SERVICES.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.title,
          description: service.detail,
        },
      })),
    },
  ];

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="neheze-site" id="home">
      <SeoHead
        title="Neheze Farms | Improved Seedlings & Orchard Services in Kaduna"
        description={pageDescription}
        canonical={CANONICAL_PATH}
        ogImage={HERO_IMAGE}
        ogImageAlt="A horticulturist tending young fruit-tree seedlings at Neheze Farms"
        twitterImage={HERO_IMAGE}
        twitterImageAlt="A horticulturist tending young fruit-tree seedlings at Neheze Farms"
        structuredData={structuredData}
      />

      <header className="nf-header">
        <div className="nf-header__inner">
          <BrandLogo />

          <button
            type="button"
            className={`nf-menu-toggle${menuOpen ? " is-open" : ""}`}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="neheze-navigation"
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span />
            <span />
          </button>

          <nav
            className={`nf-nav${menuOpen ? " is-open" : ""}`}
            id="neheze-navigation"
            aria-label="Neheze Farms navigation"
          >
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu}>
                {item.label}
              </a>
            ))}
            <Link to="/" onClick={closeMenu}>
              Tengacion
            </Link>
          </nav>

          <a className="nf-header__cta" href={whatsappHref} target="_blank" rel="noreferrer">
            Enquire now
            <LeafIcon name="arrow" />
          </a>
        </div>
      </header>

      <section className="nf-hero" aria-label="Neheze Farms introduction">
        <img className="nf-hero__image" src={HERO_IMAGE} alt="" />
        <div className="nf-hero__veil" />
        <div className="nf-shell nf-hero__content">
          <div className="nf-hero__copy">
            <p className="nf-eyebrow">
              <span />
              Fruit tree seedlings · Kwoi, Kaduna
            </p>
            <h1>
              Plant today.
              <br />
              <em>Harvest for generations.</em>
            </h1>
            <p className="nf-hero__lede">
              Healthy beginnings for productive orchards—improved seedlings, thoughtful planning,
              and expert support from first planting to lasting growth.
            </p>
            <div className="nf-hero__actions">
              <a className="nf-button nf-button--gold" href="#plants">
                Explore our plants
                <LeafIcon name="arrow" />
              </a>
              <a className="nf-button nf-button--glass" href={`tel:${PHONE_INTERNATIONAL}`}>
                <LeafIcon name="call" />
                Call {PHONE_DISPLAY}
              </a>
            </div>
          </div>

          <div className="nf-hero__proof" aria-label="Neheze Farms highlights">
            <div>
              <strong>BN 2384535</strong>
              <span>Registered enterprise</span>
            </div>
            <div>
              <strong>Improved stock</strong>
              <span>Fruit trees & flowers</span>
            </div>
            <div>
              <strong>Full support</strong>
              <span>From seedling to orchard</span>
            </div>
          </div>
        </div>
        <a className="nf-hero__scroll" href="#plants" aria-label="Scroll to our plants">
          <span>Discover</span>
          <i />
        </a>
      </section>

      <section className="nf-intro nf-shell" id="plants">
        <div className="nf-section-heading">
          <p className="nf-kicker">01 · What we grow</p>
          <h2>Better orchards begin with <em>better plants.</em></h2>
        </div>
        <p className="nf-section-intro">
          Choose from assorted improved fruit-tree seedlings, carefully presented to help growers
          start strong and plant with purpose.
        </p>
      </section>

      <section className="nf-varieties nf-shell" aria-label="Available fruit plant varieties">
        <div className="nf-varieties__panorama">
          <img
            src={VARIETIES_IMAGE}
            alt="An assortment of mango, citrus, avocado, papaya, banana, guava, and other fruit-tree seedlings"
            loading="lazy"
          />
          <div>
            <span>Grow a diverse harvest</span>
            <strong>Fruit trees for orchards, homes & institutions</strong>
          </div>
        </div>

        <div className="nf-variety-grid">
          {PLANT_GROUPS.map((item, index) => (
            <article className="nf-variety-card" key={item.name}>
              <div
                className="nf-variety-card__image"
                role="img"
                aria-label={`${item.name} plants`}
                style={{ "--nf-image-position": item.position }}
              />
              <div className="nf-variety-card__content">
                <span>{String(index + 1).padStart(2, "0")} · {item.eyebrow}</span>
                <h3>{item.name}</h3>
                <p>{item.detail}</p>
                <a href="#enquire">
                  Ask about stock
                  <LeafIcon name="arrow" size={18} />
                </a>
              </div>
            </article>
          ))}
        </div>
        <p className="nf-stock-note">
          Looking for another variety or flowering plant? Call us—current stock changes with the
          growing season.
        </p>
      </section>

      <section className="nf-services" id="services">
        <div className="nf-shell">
          <div className="nf-section-heading nf-section-heading--light">
            <p className="nf-kicker">02 · More than seedlings</p>
            <h2>Grounded expertise for every <em>stage of growth.</em></h2>
          </div>
          <div className="nf-services__grid">
            {SERVICES.map((service) => (
              <article key={service.title}>
                <span>{service.number}</span>
                <div className="nf-services__icon">
                  <LeafIcon name="sprout" size={26} />
                </div>
                <h3>{service.title}</h3>
                <p>{service.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="nf-about nf-shell" id="about">
        <div className="nf-about__media">
          <img
            className="nf-about__flyer"
            src={FLYER_IMAGE}
            alt="Original Neheze Farms business flyer"
            loading="lazy"
          />
          <div className="nf-about__seal">
            <LeafIcon name="sprout" size={30} />
            <span>Rooted in</span>
            <strong>Kwoi</strong>
          </div>
        </div>
        <div className="nf-about__copy">
          <p className="nf-kicker">03 · Our farm</p>
          <h2>Local knowledge. <em>Long-term thinking.</em></h2>
          <p className="nf-about__lead">
            Neheze Farms, Seedlings and Enterprises helps people turn planting ambitions into
            healthy, productive orchards.
          </p>
          <p>
            From improved seedling supply to orchard development, maintenance, supervision, and
            general agro consultancy, our work is built around practical decisions that support
            stronger establishment and better outcomes.
          </p>
          <dl>
            <div>
              <dt>Business name</dt>
              <dd>Neheze Farms, Seedlings and Enterprises</dd>
            </div>
            <div>
              <dt>Registration</dt>
              <dd>BN 2384535</dd>
            </div>
            <div>
              <dt>Based in</dt>
              <dd>Kwoi, Jaba LGA, Kaduna State</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="nf-process">
        <div className="nf-shell">
          <div className="nf-process__heading">
            <p className="nf-kicker">04 · Your planting journey</p>
            <h2>From an idea to a thriving orchard.</h2>
          </div>
          <ol>
            {PROCESS.map(([title, detail], index) => (
              <li key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="nf-contact" id="visit">
        <div className="nf-contact__top nf-shell">
          <div className="nf-contact__copy">
            <p className="nf-kicker">05 · Visit or enquire</p>
            <h2>Ready to grow something <em>worth keeping?</em></h2>
            <p>
              Tell us what you want to plant. We’ll help you check current availability and take
              the next practical step.
            </p>

            <div className="nf-contact__details">
              <a href={`tel:${PHONE_INTERNATIONAL}`}>
                <span><LeafIcon name="call" /></span>
                <div>
                  <small>Call the nursery</small>
                  <strong>{PHONE_DISPLAY}</strong>
                </div>
              </a>
              <a href={mapHref} target="_blank" rel="noreferrer">
                <span><LeafIcon name="map" /></span>
                <div>
                  <small>Find us in Kwoi</small>
                  <strong>Open directions</strong>
                </div>
              </a>
            </div>
          </div>

          <form className="nf-enquiry" id="enquire" onSubmit={(event) => event.preventDefault()}>
            <div className="nf-enquiry__head">
              <span><LeafIcon name="message" /></span>
              <div>
                <p>Quick enquiry</p>
                <strong>Plan your WhatsApp message</strong>
              </div>
            </div>

            <label>
              Your name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="How should we address you?"
                autoComplete="name"
              />
            </label>

            <label>
              What are you interested in?
              <select value={plant} onChange={(event) => setPlant(event.target.value)}>
                <option>Mango seedlings</option>
                <option>Citrus seedlings</option>
                <option>Avocado seedlings</option>
                <option>Papaya and banana plants</option>
                <option>Flower seedlings</option>
                <option>Orchard development</option>
                <option>Maintenance and supervision</option>
                <option>Agro consultancy</option>
                <option>Another plant or service</option>
              </select>
            </label>

            <label>
              Estimated quantity
              <select value={quantity} onChange={(event) => setQuantity(event.target.value)}>
                <option>1–10</option>
                <option>10–50</option>
                <option>50–100</option>
                <option>100–500</option>
                <option>500+</option>
                <option>I need advice</option>
              </select>
            </label>

            <a className="nf-button nf-button--dark" href={whatsappHref} target="_blank" rel="noreferrer">
              Continue on WhatsApp
              <LeafIcon name="arrow" />
            </a>
            <small>Your details stay on this device. WhatsApp opens only when you continue.</small>
          </form>
        </div>

        <div className="nf-address nf-shell">
          <div className="nf-address__number">NG</div>
          <div>
            <p className="nf-kicker">Nursery address</p>
            <address>{ADDRESS}</address>
          </div>
          <a href={mapHref} target="_blank" rel="noreferrer">
            Get directions
            <LeafIcon name="arrow" />
          </a>
        </div>
      </section>

      <footer className="nf-footer">
        <div className="nf-shell nf-footer__main">
          <BrandLogo footer />
          <div className="nf-footer__links">
            <div>
              <strong>Explore</strong>
              {NAV_ITEMS.map((item) => (
                <a key={item.href} href={item.href}>{item.label}</a>
              ))}
            </div>
            <div>
              <strong>Contact</strong>
              <a href={`tel:${PHONE_INTERNATIONAL}`}>{PHONE_LOCAL}</a>
              <a href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp enquiry</a>
              <a href={mapHref} target="_blank" rel="noreferrer">Directions to Kwoi</a>
            </div>
            <div>
              <strong>On Tengacion</strong>
              <Link to="/">Tengacion home</Link>
              <Link to="/marketplace">Marketplace</Link>
              <Link to="/contact">Contact Tengacion</Link>
            </div>
          </div>
        </div>
        <div className="nf-shell nf-footer__bottom">
          <span>© {new Date().getFullYear()} Neheze Farms, Seedlings and Enterprises.</span>
          <span>
            Designed by <Link to="/leadership">Tengacion Technologies Limited</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
