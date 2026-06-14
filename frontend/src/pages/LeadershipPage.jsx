import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";
import { FOUNDER, LEADERSHIP, TEAM_LEADS } from "../data/leadership";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  resolveSeoImage,
} from "../lib/seo";

import "./leadership.css";

const PAGE_TITLE = "Tengacion Leadership | Founder and Executive Offices";
const PAGE_DESCRIPTION =
  "Meet Stephen Daniel Kurah, Founder, Chairman and Chief Executive Officer of Tengacion, and explore the executive offices guiding the platform's growth.";

const founderJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: FOUNDER.name,
  jobTitle: FOUNDER.role,
  image: resolveSeoImage(FOUNDER.image),
  worksFor: {
    "@type": "Organization",
    name: "Tengacion",
    url: "https://tengacion.com/",
  },
};

export default function LeadershipPage() {
  return (
    <main className="leadership-page">
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical="/leadership"
        robots="index,follow"
        ogType="website"
        ogImage={FOUNDER.image}
        ogImageAlt={FOUNDER.imageAlt}
        twitterImage={FOUNDER.image}
        twitterImageAlt={FOUNDER.imageAlt}
        structuredData={[
          buildWebSiteJsonLd(),
          buildOrganizationJsonLd(),
          founderJsonLd,
          buildBreadcrumbJsonLd([
            { name: "Tengacion", url: "/" },
            { name: "Leadership", url: "/leadership" },
          ]),
        ]}
      />

      <header className="leadership-header">
        <nav className="leadership-nav" aria-label="Tengacion leadership navigation">
          <Link className="leadership-brand" to="/" aria-label="Tengacion home">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <div className="leadership-nav__links">
            <Link to="/about">About</Link>
            <Link to="/creators">Creators</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </nav>
      </header>

      <section className="leadership-hero" aria-labelledby="leadership-title">
        <p>Company leadership</p>
        <h1 id="leadership-title">Executives</h1>
        <div className="leadership-hero__rule" aria-hidden="true" />
        <span>
          Meet Tengacion&apos;s founder and explore the executive offices being built to guide
          Africa&apos;s social commerce and creator monetization platform.
        </span>
      </section>

      <section className="leadership-directory" aria-labelledby="leadership-directory-title">
        <div className="leadership-directory__intro">
          <div>
            <p className="leadership-eyebrow">Meet our leadership</p>
            <h2 id="leadership-directory-title">Founder-led, accountable by design</h2>
          </div>
          <p>
            Tengacion is building leadership around product, technology, operations, finance,
            trust, and commercial growth. Open executive roles remain clearly marked until
            appointments are formally announced.
          </p>
        </div>

        <div className="leadership-grid">
          {LEADERSHIP.map((leader) => (
            <article
              key={leader.id}
              id={leader.id}
              className={`leadership-card${leader.isPlaceholder ? " is-placeholder" : " is-founder"}`}
            >
              <div className="leadership-card__portrait">
                <img src={leader.image} alt={leader.imageAlt} loading={leader.isPlaceholder ? "lazy" : "eager"} />
                {leader.isPlaceholder ? (
                  <span className="leadership-card__status">Illustrative placeholder</span>
                ) : (
                  <span className="leadership-card__status leadership-card__status--founder">
                    Founder
                  </span>
                )}
              </div>
              <div className="leadership-card__body">
                <p className="leadership-card__role">{leader.role}</p>
                <h2>{leader.name}</h2>
                {leader.location ? <span className="leadership-card__location">{leader.location}</span> : null}
                <div className="leadership-card__rule" aria-hidden="true" />
                <p className="leadership-card__bio">{leader.bio}</p>
              </div>
            </article>
          ))}
        </div>

        <p className="leadership-placeholder-note">
          Placeholder portraits are illustrative images for unfilled executive offices. They do
          not identify appointed Tengacion officials and will be replaced after formal
          appointments.
        </p>
      </section>

      <section className="leadership-team" aria-labelledby="leadership-team-title">
        <div className="leadership-directory__intro">
          <div>
            <p className="leadership-eyebrow">Junior leadership</p>
            <h2 id="leadership-team-title">Team leads</h2>
          </div>
          <p>
            Tengacion&apos;s team leads coordinate important day-to-day work across community
            engagement and customer support.
          </p>
        </div>

        <div className="leadership-grid leadership-grid--team">
          {TEAM_LEADS.map((leader) => (
            <article key={leader.id} id={leader.id} className="leadership-card">
              <div className="leadership-card__portrait">
                <img src={leader.image} alt={leader.imageAlt} loading="lazy" />
              </div>
              <div className="leadership-card__body">
                <p className="leadership-card__role">{leader.role}</p>
                <h2>{leader.name}</h2>
                <div className="leadership-card__rule" aria-hidden="true" />
                <p className="leadership-card__bio">{leader.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="leadership-founder" aria-labelledby="leadership-founder-title">
        <div className="leadership-founder__portrait">
          <img src={FOUNDER.image} alt={FOUNDER.imageAlt} loading="lazy" />
        </div>
        <div className="leadership-founder__copy">
          <p className="leadership-eyebrow">Founder profile</p>
          <h2 id="leadership-founder-title">Building African social infrastructure for creators</h2>
          <p>{FOUNDER.bio}</p>
          <div className="leadership-founder__actions">
            <Link className="leadership-button leadership-button--primary" to="/about">
              About Tengacion
            </Link>
            <Link className="leadership-button" to="/contact">
              Contact the team
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
