import { useEffect, useState } from "react";

import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildWebSiteJsonLd,
  resolveSeoImage,
} from "../lib/seo";

import "./tovido-anthony-foundation.css";

const ASSET_ROOT = "/assets/tovido-anthony";
const CANONICAL_PATH = "/tovido-anthony-foundation";
const FOUNDATION_NAME = "Tovido Anthony Humanitarian Foundation";
const HERO_IMAGE = `${ASSET_ROOT}/community-learning-hero.jpg`;

const FOUNDATION = {
  address: "Kaduna, Nigeria",
  cacNumber: "9649700",
  email: "tovidoanthonyfoundation@gmail.com",
  handle: "@tovidoanthonyfoundation",
  incorporated: "2 July 2026",
  phoneDisplay: "0904 242 0446",
  phoneInternational: "+2349042420446",
  trustee: "Anthony Unah",
};

const NAV_ITEMS = [
  { href: "#about", label: "About" },
  { href: "#programs", label: "Programs" },
  { href: "#registration", label: "Registration" },
  { href: "#gallery", label: "Gallery" },
  { href: "#contact", label: "Contact" },
];

const PROGRAMS = [
  {
    number: "01",
    title: "Humanitarian relief",
    description:
      "Providing immediate assistance and practical support to vulnerable individuals and communities.",
  },
  {
    number: "02",
    title: "Education & child welfare",
    description:
      "Promoting access to quality education, learning resources, skills development, and the wellbeing of children.",
  },
  {
    number: "03",
    title: "Healthcare & wellness",
    description:
      "Improving access to health support and promoting healthier lives, prevention, and community wellbeing.",
  },
  {
    number: "04",
    title: "Youth & women empowerment",
    description:
      "Equipping young people and women with confidence, practical skills, leadership, and opportunity.",
  },
  {
    number: "05",
    title: "Livelihoods & poverty alleviation",
    description:
      "Creating pathways to sustainable livelihoods through vocational training and practical solutions.",
  },
  {
    number: "06",
    title: "Sustainable development",
    description:
      "Building resilient communities for long-term growth, stability, inclusion, and positive change.",
  },
];

const PEOPLE_WE_SERVE = [
  "Widows",
  "Widowers",
  "Less-privileged people",
  "Children",
  "Youth",
  "Women",
  "Underserved communities",
];

const VALUES = [
  {
    title: "Compassion",
    detail: "Meeting people with dignity, empathy, and care.",
  },
  {
    title: "Empowerment",
    detail: "Building confidence, self-reliance, and opportunity.",
  },
  {
    title: "Community",
    detail: "Working together for inclusive, lasting progress.",
  },
  {
    title: "Hope",
    detail: "Helping people see and build a brighter future.",
  },
];

const GALLERY = [
  {
    src: `${ASSET_ROOT}/foundation-team.jpg`,
    alt: "Members of the Tovido Anthony Humanitarian Foundation team in branded shirts",
    caption: "The foundation team",
  },
  {
    src: `${ASSET_ROOT}/team-community-visit.jpg`,
    alt: "Tovido Anthony Humanitarian Foundation representatives during a community visit",
    caption: "Community connection",
  },
  {
    src: `${ASSET_ROOT}/team-partnership-visit.jpg`,
    alt: "Foundation representatives presenting organizational materials during a stakeholder visit",
    caption: "Building partnerships",
  },
  {
    src: `${ASSET_ROOT}/team-stakeholder-visit.jpg`,
    alt: "Foundation representatives meeting with a community stakeholder",
    caption: "Stakeholder engagement",
  },
  {
    src: `${ASSET_ROOT}/team-community-outreach.jpg`,
    alt: "Two Tovido Anthony Humanitarian Foundation representatives at a community event",
    caption: "Showing up for community",
  },
];

const SOCIAL_LINKS = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/tovidoanthonyfoundation",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/tovidoanthonyfoundation/",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@tovidoanthonyfoundation",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@tovidoanthonyfoundation",
  },
];

const partnershipMailto = `mailto:${FOUNDATION.email}?subject=${encodeURIComponent(
  "Partnership enquiry for Tovido Anthony Humanitarian Foundation"
)}`;
const volunteerMailto = `mailto:${FOUNDATION.email}?subject=${encodeURIComponent(
  "Volunteer interest"
)}`;
const whatsappUrl = `https://wa.me/${FOUNDATION.phoneInternational.replace(
  /\D/g,
  ""
)}?text=${encodeURIComponent(
  "Hello Tovido Anthony Humanitarian Foundation, I would like to learn more about supporting your work."
)}`;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function FoundationLogo() {
  return (
    <a className="tovido-brand" href="#home" aria-label={`${FOUNDATION_NAME} home`}>
      <img src={`${ASSET_ROOT}/tovido-logo.png`} alt="" />
      <span>
        <strong>Tovido Anthony</strong>
        <small>Humanitarian Foundation</small>
      </span>
    </a>
  );
}

export default function TovidoAnthonyFoundationPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const description =
    "Official website of Tovido Anthony Humanitarian Foundation, a CAC-registered nonprofit in Kaduna supporting relief, education, health, empowerment, livelihoods, and sustainable communities.";
  const organizationUrl = buildCanonicalUrl(CANONICAL_PATH);
  const structuredData = [
    buildWebSiteJsonLd(),
    buildBreadcrumbJsonLd([
      { name: "Tengacion", url: "/" },
      { name: FOUNDATION_NAME, url: CANONICAL_PATH },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "NGO",
      name: FOUNDATION_NAME,
      url: organizationUrl,
      logo: resolveSeoImage(`${ASSET_ROOT}/tovido-logo.png`),
      image: resolveSeoImage(HERO_IMAGE),
      description,
      email: FOUNDATION.email,
      telephone: FOUNDATION.phoneInternational,
      identifier: {
        "@type": "PropertyValue",
        name: "Corporate Affairs Commission registration number",
        value: FOUNDATION.cacNumber,
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Kaduna",
        addressCountry: "NG",
      },
      sameAs: SOCIAL_LINKS.map((link) => link.href),
    },
  ];

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="tovido-site" id="home">
      <SeoHead
        title={`${FOUNDATION_NAME} | Official Website`}
        description={description}
        canonical={CANONICAL_PATH}
        ogType="website"
        ogImage={HERO_IMAGE}
        ogImageAlt="A community learning activity in northern Nigeria"
        twitterImage={HERO_IMAGE}
        twitterImageAlt="A community learning activity in northern Nigeria"
        structuredData={structuredData}
      />

      <a className="tovido-skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="tovido-header">
        <FoundationLogo />

        <button
          className="tovido-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="tovido-primary-navigation"
          aria-label={`${menuOpen ? "Close" : "Open"} navigation`}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span />
          <span />
        </button>

        <nav
          className={`tovido-nav${menuOpen ? " is-open" : ""}`}
          id="tovido-primary-navigation"
          aria-label="Foundation website navigation"
        >
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenu}>
              {item.label}
            </a>
          ))}
          <a
            className="tovido-nav__tengacion"
            href="https://www.tengacion.com"
            onClick={closeMenu}
          >
            Tengacion
          </a>
          <a className="tovido-nav__cta" href={partnershipMailto} onClick={closeMenu}>
            Partner with us
          </a>
        </nav>
      </header>

      <section className="tovido-hero" aria-labelledby="tovido-hero-title">
        <img
          className="tovido-hero__image"
          src={HERO_IMAGE}
          alt="Children, parents, and volunteers taking part in a community learning activity"
        />
        <div className="tovido-hero__overlay" />
        <div className="tovido-hero__copy">
          <p className="tovido-eyebrow">Official foundation website · Powered by Tengacion</p>
          <h1 id="tovido-hero-title">
            Restoring hope.
            {" "}
            <span>Strengthening communities.</span>
          </h1>
          <p>
            We are a nonprofit organization dedicated to bringing hope and positive change through
            relief, education, health, empowerment, and sustainable community support.
          </p>
          <div className="tovido-actions">
            <a className="tovido-button tovido-button--primary" href="#programs">
              Explore our programs
              <ArrowIcon />
            </a>
            <a className="tovido-button tovido-button--ghost" href={partnershipMailto}>
              Support the mission
            </a>
          </div>
        </div>
        <div className="tovido-hero__facts" aria-label="Foundation registration facts">
          <div>
            <span>CAC registered</span>
            <strong>No. {FOUNDATION.cacNumber}</strong>
          </div>
          <div>
            <span>Based in</span>
            <strong>{FOUNDATION.address}</strong>
          </div>
          <div>
            <span>Our promise</span>
            <strong>Compassion in action</strong>
          </div>
        </div>
      </section>

      <div id="main-content">
        <section className="tovido-section tovido-intro" id="about">
          <div className="tovido-section__heading">
            <p className="tovido-eyebrow">Who we are</p>
            <h2>Every person deserves the opportunity to heal, learn, and build a brighter future.</h2>
          </div>
          <div className="tovido-intro__body">
            <div className="tovido-intro__copy">
              <p className="tovido-lead">
                Tovido Anthony Humanitarian Foundation exists to help vulnerable people regain
                confidence, unlock their potential, and build sustainable livelihoods.
              </p>
              <p>
                Our work brings together humanitarian support, child welfare, psychosocial care,
                vocational training, youth opportunity, women’s empowerment, and practical
                community development. We believe lasting progress is built with people—not simply
                delivered to them.
              </p>
              <div className="tovido-audience" aria-label="People and communities we serve">
                {PEOPLE_WE_SERVE.map((group) => (
                  <span key={group}>{group}</span>
                ))}
              </div>
            </div>
            <figure className="tovido-intro__photo">
              <img
                src={`${ASSET_ROOT}/foundation-team.jpg`}
                alt="The Tovido Anthony Humanitarian Foundation team"
                loading="lazy"
              />
              <figcaption>
                <span>Local presence</span>
                <strong>A team committed to practical, people-first action.</strong>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="tovido-programs" id="programs" aria-labelledby="programs-title">
          <div className="tovido-section tovido-programs__inner">
            <div className="tovido-section__heading tovido-section__heading--light">
              <p className="tovido-eyebrow">Our mandate</p>
              <h2 id="programs-title">Six connected pathways to stronger communities.</h2>
              <p>
                Our programs respond to urgent needs while helping people build the knowledge,
                wellbeing, and opportunity required for lasting independence.
              </p>
            </div>
            <div className="tovido-program-grid">
              {PROGRAMS.map((program) => (
                <article key={program.number} className="tovido-program-card">
                  <span>{program.number}</span>
                  <h3>{program.title}</h3>
                  <p>{program.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tovido-section tovido-program-story">
          <figure>
            <img
              src={`${ASSET_ROOT}/community-programs.jpg`}
              alt="A community health worker leading a practical learning session with women and children"
              loading="lazy"
            />
            <figcaption>Illustrative community program scene</figcaption>
          </figure>
          <div className="tovido-program-story__copy">
            <p className="tovido-eyebrow">Empowerment changes lives</p>
            <h2>From immediate support to sustainable livelihoods.</h2>
            <p>
              Through psychosocial support, skills development, vocational training, education, and
              health awareness, people can rebuild confidence and create a more secure future.
            </p>
            <blockquote>
              “When we invest in youth, we invest in a greater future.”
            </blockquote>
            <a className="tovido-text-link" href={volunteerMailto}>
              Volunteer your time
              <ArrowIcon />
            </a>
          </div>
        </section>

        <section className="tovido-values" aria-labelledby="values-title">
          <div className="tovido-section tovido-values__inner">
            <div>
              <p className="tovido-eyebrow">What guides us</p>
              <h2 id="values-title">Compassion. Empowerment. Community. Hope.</h2>
            </div>
            <div className="tovido-values__grid">
              {VALUES.map((value, index) => (
                <article key={value.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{value.title}</h3>
                  <p>{value.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tovido-section tovido-registration" id="registration">
          <div className="tovido-registration__seal" aria-hidden="true">
            <img src={`${ASSET_ROOT}/tovido-logo.png`} alt="" loading="lazy" />
          </div>
          <div className="tovido-registration__copy">
            <p className="tovido-eyebrow">Registered. Accountable. Community-led.</p>
            <h2>Officially incorporated in Nigeria.</h2>
            <p>
              Tovido Anthony Humanitarian Foundation is registered as a corporate body with
              Nigeria’s Corporate Affairs Commission.
            </p>
            <dl>
              <div>
                <dt>CAC registration number</dt>
                <dd>{FOUNDATION.cacNumber}</dd>
              </div>
              <div>
                <dt>Date of incorporation</dt>
                <dd>{FOUNDATION.incorporated}</dd>
              </div>
              <div>
                <dt>Appointed trustee</dt>
                <dd>{FOUNDATION.trustee}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{FOUNDATION.address}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="tovido-section tovido-gallery-section" id="gallery">
          <div className="tovido-section__heading tovido-section__heading--gallery">
            <div>
              <p className="tovido-eyebrow">Foundation in focus</p>
              <h2>Relationships are where impact begins.</h2>
            </div>
            <p>
              A growing record of the team, stakeholder conversations, and community connections
              behind the foundation’s work.
            </p>
          </div>
          <div className="tovido-gallery">
            {GALLERY.map((photo, index) => (
              <figure key={photo.src} className={`tovido-gallery__item tovido-gallery__item--${index + 1}`}>
                <img src={photo.src} alt={photo.alt} loading="lazy" />
                <figcaption>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {photo.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="tovido-contact" id="contact" aria-labelledby="contact-title">
          <div className="tovido-contact__copy">
            <p className="tovido-eyebrow">Join the work</p>
            <h2 id="contact-title">Together, we can touch more lives.</h2>
            <p>
              Partner, volunteer, advocate, or start a conversation about supporting the
              foundation’s humanitarian and community-development programs.
            </p>
            <div className="tovido-actions">
              <a className="tovido-button tovido-button--gold" href={partnershipMailto}>
                Email the foundation
                <ArrowIcon />
              </a>
              <a
                className="tovido-button tovido-button--ghost-light"
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
              >
                Chat on WhatsApp
              </a>
            </div>
          </div>

          <address className="tovido-contact__details">
            <div>
              <span>Email</span>
              <a href={`mailto:${FOUNDATION.email}`}>{FOUNDATION.email}</a>
            </div>
            <div>
              <span>Phone</span>
              <a href={`tel:${FOUNDATION.phoneInternational}`}>{FOUNDATION.phoneDisplay}</a>
            </div>
            <div>
              <span>Address</span>
              <strong>{FOUNDATION.address}</strong>
            </div>
            <div>
              <span>Social</span>
              <strong>{FOUNDATION.handle}</strong>
            </div>
          </address>
        </section>
      </div>

      <footer className="tovido-footer">
        <div className="tovido-footer__top">
          <FoundationLogo />
          <div className="tovido-footer__socials" aria-label="Official social media links">
            {SOCIAL_LINKS.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="tovido-footer__bottom">
          <p>
            © {new Date().getFullYear()} {FOUNDATION_NAME}. All rights reserved.
          </p>
          <a className="tovido-footer__credit" href="https://www.tengacion.com">
            Designed by Tengacion Technologies Limited ↗
          </a>
          <a href="#home">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
