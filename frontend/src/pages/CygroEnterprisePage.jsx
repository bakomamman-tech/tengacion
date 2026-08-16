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

import "./cygro-enterprise.css";

const CANONICAL_PATH = "/cygro-enterprise";
const ASSET_ROOT = "/assets/cygro-enterprise";
const LOGO_IMAGE = `${ASSET_ROOT}/cygro-logo.png`;
const HERO_IMAGE = `${ASSET_ROOT}/field-rows-hero.jpg`;
const SYSTEM_IMAGE = `${ASSET_ROOT}/agritech-field-network.jpg`;
const PHONE_DISPLAY = "+234 806 001 2595";
const PHONE_NUMBER = "+2348060012595";
const WHATSAPP_NUMBER = "2348060012595";
const EMAIL = "Cygro.enterprise@aol.com";
const ADDRESS = "No. 2 Ligari Road, Kaduna, Kaduna State, Nigeria";

const NAV_ITEMS = [
  { href: "#about", label: "About" },
  { href: "#services", label: "Services" },
  { href: "#fieldwork", label: "Fieldwork" },
  { href: "#purpose", label: "Purpose" },
  { href: "#contact", label: "Contact" },
];

const SERVICES = [
  {
    number: "01",
    icon: "circuit",
    title: "Agri-Tech & digital services",
    detail:
      "Technology-led support that improves farm operations, market access, and data-informed decisions for farmers and agribusinesses.",
  },
  {
    number: "02",
    icon: "growth",
    title: "Agribusiness SME support",
    detail:
      "Business development, practical advisory, and market-linkage support for small and medium agricultural enterprises.",
  },
  {
    number: "03",
    icon: "field",
    title: "On-farm production",
    detail:
      "Crop and livestock production support grounded in best practices, input guidance, and farm-level solutions.",
  },
  {
    number: "04",
    icon: "training",
    title: "Training & capacity building",
    detail:
      "Practical workshops, programmes, and mentorship that equip farmers and agri-entrepreneurs with skills for growth.",
  },
];

const FIELD_IMAGES = [
  {
    src: `${ASSET_ROOT}/tomato-harvest.jpg`,
    alt: "Farm workers gathering baskets of harvested tomatoes",
    label: "Harvest operations",
    className: "cygro-gallery__item--wide",
  },
  {
    src: `${ASSET_ROOT}/nursery-beds.jpg`,
    alt: "Organised seedling nursery beds",
    label: "Strong starts",
    className: "cygro-gallery__item--tall",
  },
  {
    src: `${ASSET_ROOT}/poultry-production.jpg`,
    alt: "Healthy poultry flock under farm management",
    label: "Livestock production",
    className: "",
  },
  {
    src: `${ASSET_ROOT}/crop-care.jpg`,
    alt: "A farm worker caring for crops in the field",
    label: "Field-level solutions",
    className: "cygro-gallery__item--tall",
  },
  {
    src: `${ASSET_ROOT}/okra-field.jpg`,
    alt: "A productive green okra field",
    label: "Productive systems",
    className: "cygro-gallery__item--wide",
  },
  {
    src: `${ASSET_ROOT}/maize-harvest.jpg`,
    alt: "Fresh maize after harvest",
    label: "From farm to market",
    className: "",
  },
];

const ENQUIRY_OPTIONS = [
  "Agri-Tech and digital services",
  "Agribusiness advisory",
  "Crop or livestock production support",
  "Training and capacity building",
  "Drip irrigation design and installation",
  "A partnership opportunity",
];

function CygroIcon({ name, size = 24 }) {
  const drawings = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    circuit: (
      <>
        <path d="M5 17V7l7-4 7 4v10l-7 4-7-4Z" />
        <path d="M8.5 14.5 12 11l3.5 3.5" />
        <circle cx="12" cy="8" r="1.4" />
        <circle cx="8.5" cy="14.5" r="1.4" />
        <circle cx="15.5" cy="14.5" r="1.4" />
      </>
    ),
    growth: (
      <>
        <path d="M5 19h14" />
        <path d="m6 15 4-4 3 2 5-6" />
        <path d="M14 7h4v4" />
      </>
    ),
    field: (
      <>
        <path d="M4 19c4-5 12-5 16 0" />
        <path d="M6 15c3-4 9-4 12 0" />
        <path d="M9 11c1.8-2.2 4.2-2.2 6 0" />
        <path d="M12 5v14" />
      </>
    ),
    training: (
      <>
        <path d="m3 9 9-5 9 5-9 5-9-5Z" />
        <path d="M7 12v4c2.7 2 7.3 2 10 0v-4" />
        <path d="M21 9v6" />
      </>
    ),
    phone: (
      <path d="M7.2 3.8 9.4 8 6.9 9.5c1.1 2.4 3.1 4.4 5.5 5.5l1.5-2.5 4.3 2.2-.7 3.5c-.2.9-1 1.6-2 1.6C9.3 19.8 4.2 14.7 4.2 8.5c0-.9.7-1.7 1.6-2l1.4-2.7Z" />
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    map: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
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
      {drawings[name]}
    </svg>
  );
}

function CygroBrand({ footer = false }) {
  return (
    <a
      className={`cygro-brand${footer ? " cygro-brand--footer" : ""}`}
      href="#top"
      aria-label="Cygro Enterprise home"
    >
      <img src={LOGO_IMAGE} alt="Cygro Enterprise" />
      <span>
        <strong>CYGRO</strong>
        <small>ENTERPRISE</small>
      </span>
    </a>
  );
}

export default function CygroEnterprisePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState("");
  const [interest, setInterest] = useState(ENQUIRY_OPTIONS[0]);

  const whatsappHref = useMemo(() => {
    const introduction = name.trim() ? `My name is ${name.trim()}. ` : "";
    const message = `Hello Cygro Enterprise. ${introduction}I would like to discuss ${interest.toLowerCase()}. Please share the next steps.`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }, [interest, name]);

  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`;
  const description =
    "Cygro Enterprise delivers agri-tech, digital services, farm production support, agribusiness advisory, irrigation solutions, and practical training in Nigeria.";
  const structuredData = [
    buildWebSiteJsonLd(),
    buildOrganizationJsonLd(),
    buildBreadcrumbJsonLd([
      { name: "Tengacion", url: "/" },
      { name: "Cygro Enterprise", url: CANONICAL_PATH },
    ]),
    {
      "@context": "https://schema.org",
      "@type": ["Organization", "LocalBusiness"],
      name: "Cygro Enterprise",
      url: buildCanonicalUrl(CANONICAL_PATH),
      logo: resolveSeoImage(LOGO_IMAGE),
      image: resolveSeoImage(HERO_IMAGE),
      description,
      identifier: "BN 7865737",
      foundingDate: "2024-08-23",
      founder: {
        "@type": "Person",
        name: "Stephen Adebayo",
      },
      telephone: PHONE_NUMBER,
      email: EMAIL,
      address: {
        "@type": "PostalAddress",
        streetAddress: "No. 2 Ligari Road",
        addressLocality: "Kaduna",
        addressRegion: "Kaduna State",
        addressCountry: "NG",
      },
      areaServed: "Nigeria",
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
    <main className="cygro-site" id="top">
      <SeoHead
        title="Cygro Enterprise | Agri-Tech & Digital Services in Nigeria"
        description={description}
        canonical={CANONICAL_PATH}
        ogImage={HERO_IMAGE}
        ogImageAlt="Cultivated fields supported by Cygro Enterprise"
        twitterImage={HERO_IMAGE}
        twitterImageAlt="Cultivated fields supported by Cygro Enterprise"
        structuredData={structuredData}
      />

      <header className="cygro-header">
        <CygroBrand />

        <button
          type="button"
          className={`cygro-menu${menuOpen ? " is-open" : ""}`}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="cygro-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>

        <nav
          className={`cygro-nav${menuOpen ? " is-open" : ""}`}
          id="cygro-navigation"
          aria-label="Cygro Enterprise navigation"
        >
          {NAV_ITEMS.map((item) => (
            <a href={item.href} key={item.href} onClick={closeMenu}>
              {item.label}
            </a>
          ))}
          <Link className="cygro-nav__tengacion" to="/" onClick={closeMenu}>
            On Tengacion
          </Link>
        </nav>

        <a className="cygro-header__cta" href={whatsappHref} target="_blank" rel="noreferrer">
          Start a conversation
          <CygroIcon name="arrow" size={18} />
        </a>
      </header>

      <section className="cygro-hero" aria-label="Cygro Enterprise introduction">
        <img className="cygro-hero__image" src={HERO_IMAGE} alt="" />
        <div className="cygro-hero__overlay" />

        <div className="cygro-shell cygro-hero__content">
          <div className="cygro-hero__copy">
            <p className="cygro-eyebrow cygro-eyebrow--light">
              <span />
              Nigeria · Agribusiness · Agri-Tech
            </p>
            <h1>
              Grow smarter.
              <em>Feed the future.</em>
            </h1>
            <p>
              Agri-Tech and digital services for African food systems—connecting practical farm
              support, stronger businesses, and the tools to grow sustainably.
            </p>
            <div className="cygro-actions">
              <a className="cygro-button cygro-button--sun" href="#services">
                Explore what we do
                <CygroIcon name="arrow" size={19} />
              </a>
              <a className="cygro-button cygro-button--glass" href={`tel:${PHONE_NUMBER}`}>
                <CygroIcon name="phone" size={19} />
                Call Cygro
              </a>
            </div>
          </div>

          <div className="cygro-hero__rail" aria-label="Cygro Enterprise highlights">
            <div>
              <span>Registered business</span>
              <strong>BN 7865737</strong>
            </div>
            <div>
              <span>Built for</span>
              <strong>African food systems</strong>
            </div>
            <div>
              <span>Based in</span>
              <strong>Kaduna, Nigeria</strong>
            </div>
          </div>
        </div>

        <a className="cygro-scroll" href="#about" aria-label="Scroll to learn about Cygro">
          <span>Discover</span>
          <i />
        </a>
      </section>

      <section className="cygro-about cygro-shell" id="about">
        <div className="cygro-section-heading">
          <p className="cygro-eyebrow"><span />01 · Who we are</p>
          <h2>A practical partner for the people <em>building Africa’s food future.</em></h2>
        </div>

        <div className="cygro-about__body">
          <div className="cygro-about__copy">
            <p className="cygro-lead">
              Cygro Enterprise is a Nigeria-based agribusiness and agri-tech company helping
              farmers and small businesses turn agricultural potential into resilient,
              profitable growth.
            </p>
            <p>
              We strengthen on-farm crop and livestock production while delivering digital
              services, training, business advisory, and market support for agribusiness SMEs.
            </p>
            <div className="cygro-community-note">
              <span><CygroIcon name="circuit" /></span>
              <p>
                A member of the <strong>African Food Changemakers</strong> community of
                entrepreneurs building the future of food in Africa.
              </p>
            </div>
          </div>

          <figure className="cygro-about__media">
            <img
              src={`${ASSET_ROOT}/nursery-beds.jpg`}
              alt="Seedlings growing in organised nursery beds"
              loading="lazy"
            />
            <figcaption>
              <span>From the ground up</span>
              <strong>Better systems begin with practical field knowledge.</strong>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="cygro-services" id="services">
        <div className="cygro-shell">
          <div className="cygro-section-heading cygro-section-heading--split">
            <div>
              <p className="cygro-eyebrow"><span />02 · What we do</p>
              <h2>Where agriculture meets <em>useful innovation.</em></h2>
            </div>
            <p>
              Support designed around real farms and real businesses—from production decisions
              to digital capability, market access, and long-term resilience.
            </p>
          </div>

          <div className="cygro-service-grid">
            {SERVICES.map((service) => (
              <article key={service.title}>
                <div className="cygro-service-card__top">
                  <span>{service.number}</span>
                  <i><CygroIcon name={service.icon} size={27} /></i>
                </div>
                <h3>{service.title}</h3>
                <p>{service.detail}</p>
                <a href="#contact">
                  Discuss this service
                  <CygroIcon name="arrow" size={17} />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="cygro-system"
        style={{ "--cygro-system-image": `url(${SYSTEM_IMAGE})` }}
      >
        <div className="cygro-shell cygro-system__inner">
          <p className="cygro-eyebrow cygro-eyebrow--light"><span />Connected thinking</p>
          <blockquote>
            Better food systems emerge when field experience, business knowledge, and technology
            move in the same direction.
          </blockquote>
          <div className="cygro-system__pillars">
            <div><strong>01</strong><span>Farm intelligence</span></div>
            <div><strong>02</strong><span>Business resilience</span></div>
            <div><strong>03</strong><span>Skills that travel</span></div>
          </div>
        </div>
      </section>

      <section className="cygro-fieldwork cygro-shell" id="fieldwork">
        <div className="cygro-section-heading cygro-section-heading--split">
          <div>
            <p className="cygro-eyebrow"><span />03 · In the field</p>
            <h2>Rooted in the <em>work itself.</em></h2>
          </div>
          <p>
            Cygro’s work spans nurseries, crops, livestock, field care, harvest operations, and
            the practical systems that connect production to opportunity.
          </p>
        </div>

        <div className="cygro-gallery">
          {FIELD_IMAGES.map((image, index) => (
            <figure className={image.className} key={image.src}>
              <img src={image.src} alt={image.alt} loading="lazy" />
              <figcaption>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {image.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="cygro-irrigation">
        <div className="cygro-shell cygro-irrigation__inner">
          <figure>
            <img
              src={`${ASSET_ROOT}/irrigation-system-design.jpg`}
              alt="A two-hectare drip irrigation system designed by Cygro Enterprise"
              loading="lazy"
            />
            <figcaption>Two-hectare drip irrigation system concept designed by Cygro Enterprise</figcaption>
          </figure>

          <div className="cygro-irrigation__copy">
            <p className="cygro-eyebrow"><span />Smart irrigation</p>
            <h2>Designed for every drop to <em>work harder.</em></h2>
            <p>
              Cygro also brings technical planning to irrigation—translating crop requirements,
              land dimensions, and water delivery into clear, usable systems.
            </p>
            <ul>
              <li><CygroIcon name="check" />Drip irrigation design and installation</li>
              <li><CygroIcon name="check" />Materials and equipment guidance</li>
              <li><CygroIcon name="check" />Technical support and after-sales service</li>
            </ul>
            <a className="cygro-text-link" href="#contact">
              Plan a farm solution
              <CygroIcon name="arrow" size={18} />
            </a>
          </div>
        </div>
      </section>

      <section className="cygro-purpose" id="purpose">
        <div className="cygro-shell">
          <div className="cygro-purpose__intro">
            <p className="cygro-eyebrow cygro-eyebrow--light"><span />04 · Purpose</p>
            <h2>Progress that reaches <em>the whole value chain.</em></h2>
          </div>

          <div className="cygro-purpose__grid">
            <article>
              <span>Mission</span>
              <p>
                To empower African farmers and agribusiness SMEs with the tools, knowledge, and
                technology needed to increase productivity, improve livelihoods, and build
                resilient food systems.
              </p>
            </article>
            <article>
              <span>Vision</span>
              <p>
                A thriving African agricultural sector where small businesses can access the
                technology, markets, and skills to feed the continent sustainably.
              </p>
            </article>
          </div>

          <div className="cygro-founder">
            <img src={LOGO_IMAGE} alt="" loading="lazy" />
            <div>
              <span>Leadership</span>
              <h3>Stephen Adebayo</h3>
              <p>
                Founder and agri-entrepreneur focused on agri-tech, digital services, and capacity
                building in Nigeria.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="cygro-registration cygro-shell">
        <div className="cygro-registration__seal">
          <span>CAC</span>
          <strong>7865737</strong>
          <small>Registered 23 August 2024</small>
        </div>
        <div className="cygro-registration__copy">
          <p className="cygro-eyebrow"><span />Built on a registered foundation</p>
          <h2>Cygro Enterprise is a registered Nigerian business.</h2>
          <p>
            The Corporate Affairs Commission certificate records the business under the Companies
            and Allied Matters Act 2020, with animal production as its registered nature of business.
          </p>
          <dl>
            <div><dt>Registered name</dt><dd>Cygro Enterprise</dd></div>
            <div><dt>Business number</dt><dd>BN 7865737</dd></div>
            <div><dt>Principal address</dt><dd>No. 2 Ligari Road, Kaduna</dd></div>
            <div><dt>Country</dt><dd>Nigeria</dd></div>
          </dl>
        </div>
      </section>

      <section className="cygro-contact" id="contact">
        <div className="cygro-shell cygro-contact__inner">
          <div className="cygro-contact__copy">
            <p className="cygro-eyebrow cygro-eyebrow--light"><span />05 · Work with Cygro</p>
            <h2>Let’s build the next season of <em>growth together.</em></h2>
            <p>
              Share the farm, business, training, or partnership challenge you are working on.
              Cygro will help you identify a practical next step.
            </p>

            <div className="cygro-contact__details">
              <a href={`tel:${PHONE_NUMBER}`}>
                <i><CygroIcon name="phone" /></i>
                <span><small>Call or WhatsApp</small><strong>{PHONE_DISPLAY}</strong></span>
              </a>
              <a href={`mailto:${EMAIL}`}>
                <i><CygroIcon name="mail" /></i>
                <span><small>Email Cygro</small><strong>{EMAIL}</strong></span>
              </a>
              <a href={mapHref} target="_blank" rel="noreferrer">
                <i><CygroIcon name="map" /></i>
                <span><small>Registered address</small><strong>No. 2 Ligari Road, Kaduna</strong></span>
              </a>
            </div>
          </div>

          <form className="cygro-enquiry" onSubmit={(event) => event.preventDefault()}>
            <div className="cygro-enquiry__heading">
              <span>Quick enquiry</span>
              <strong>Open a useful WhatsApp conversation</strong>
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
              I want to discuss
              <select value={interest} onChange={(event) => setInterest(event.target.value)}>
                {ENQUIRY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <a
              className="cygro-button cygro-button--dark"
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
            >
              Continue on WhatsApp
              <CygroIcon name="arrow" size={19} />
            </a>
            <small>Your details remain on this device until you choose to continue.</small>
          </form>
        </div>
      </section>

      <footer className="cygro-footer">
        <div className="cygro-shell cygro-footer__top">
          <CygroBrand footer />
          <div className="cygro-footer__links">
            <div>
              <strong>Explore</strong>
              {NAV_ITEMS.slice(0, 4).map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
            </div>
            <div>
              <strong>Connect</strong>
              <a href={`tel:${PHONE_NUMBER}`}>{PHONE_DISPLAY}</a>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              <a href={mapHref} target="_blank" rel="noreferrer">Kaduna, Nigeria</a>
            </div>
            <div>
              <strong>On Tengacion</strong>
              <Link to="/">Tengacion home</Link>
              <Link to="/marketplace">Marketplace</Link>
              <Link to="/contact">Contact Tengacion</Link>
            </div>
          </div>
        </div>
        <div className="cygro-shell cygro-footer__bottom">
          <p>© {new Date().getFullYear()} Cygro Enterprise · BN 7865737</p>
          <Link to="/leadership">Website by Tengacion Technologies Limited</Link>
        </div>
      </footer>
    </main>
  );
}
