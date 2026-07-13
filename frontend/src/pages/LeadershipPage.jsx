import { Link } from "react-router-dom";

import PublicNav from "../components/PublicNav";
import SeoHead from "../components/seo/SeoHead";
import { FOUNDER, INTERNS, LEADERSHIP, TEAM_LEADS } from "../data/leadership";
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
    <div className="leadership-page">
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
        <PublicNav theme="dark" />
      </header>

      <main className="leadership-main">
        <section className="leadership-hero" aria-labelledby="leadership-title">
          <div className="leadership-hero__inner">
            <div className="leadership-hero__copy">
              <p className="leadership-hero__eyebrow">
                <span aria-hidden="true" />
                Company leadership
              </p>
              <h1 id="leadership-title">
                Verified <span>team members</span>
              </h1>
              <p className="leadership-hero__lede">
                Meet the people currently identified as part of Tengacion&apos;s
                public team&mdash;and the leaders accountable for moving our
                platform forward.
              </p>

              <div className="leadership-hero__actions">
                <a
                  className="leadership-button leadership-button--primary"
                  href="#leadership-directory"
                >
                  Meet the team
                  <span aria-hidden="true">&darr;</span>
                </a>
                <Link
                  className="leadership-button leadership-button--ghost"
                  to="/about"
                >
                  Our story
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>

              <p className="leadership-hero__assurance">
                <span aria-hidden="true">&#10003;</span>
                Only publicly confirmed profiles and roles are listed here.
              </p>
            </div>

            <aside
              className="leadership-brief"
              aria-label="Tengacion public leadership register"
            >
              <div className="leadership-brief__topline">
                <span>Public team register</span>
                <strong>
                  <i aria-hidden="true" />
                  Current
                </strong>
              </div>

              <div className="leadership-brief__brand">
                <span className="leadership-brief__logo">
                  <img
                    src="/tengacion_logo_128.png"
                    width="128"
                    height="128"
                    alt=""
                  />
                </span>
                <span>
                  <small>Tengacion leadership</small>
                  <strong>People, roles &amp; accountability</strong>
                </span>
              </div>

              <dl className="leadership-brief__stats">
                <div>
                  <dt>Founder</dt>
                  <dd>{LEADERSHIP.length}</dd>
                </div>
                <div>
                  <dt>Team leads</dt>
                  <dd>{TEAM_LEADS.length}</dd>
                </div>
                <div>
                  <dt>Interns</dt>
                  <dd>{INTERNS.length}</dd>
                </div>
              </dl>

              <nav
                className="leadership-brief__links"
                aria-label="Leadership directory sections"
              >
                <a href="#leadership-directory">Executive</a>
                <a href="#leadership-team">Team leads</a>
                <a href="#leadership-interns">Interns</a>
              </nav>
            </aside>
          </div>
        </section>

        <section
          id="leadership-directory"
          className="leadership-directory"
          aria-labelledby="leadership-directory-title"
        >
          <div className="leadership-directory__intro">
            <div>
              <p className="leadership-eyebrow">
                <span>01</span>
                Meet our leadership
              </p>
              <h2 id="leadership-directory-title">
                Founder-led, accountable by design
              </h2>
            </div>
            <p>
              Tengacion displays only team members with verified profiles and
              roles on this public page. Additional appointments will be added
              after they are formally confirmed.
            </p>
          </div>

          <div className="leadership-grid leadership-grid--executive">
            {LEADERSHIP.map((leader) => (
              <article
                key={leader.id}
                id={leader.id}
                className="leadership-card is-founder"
              >
                <div className="leadership-card__portrait">
                  <img
                    src={leader.image}
                    alt={leader.imageAlt}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="leadership-card__status leadership-card__status--founder">
                    Founder
                  </span>
                </div>
                <div className="leadership-card__body">
                  <p className="leadership-card__role">{leader.role}</p>
                  <h3>{leader.name}</h3>
                  {leader.location ? (
                    <span className="leadership-card__location">
                      {leader.location}
                    </span>
                  ) : null}
                  <div className="leadership-card__rule" aria-hidden="true" />
                  <p className="leadership-card__bio">{leader.bio}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="leadership-team"
          className="leadership-team"
          aria-labelledby="leadership-team-title"
        >
          <div className="leadership-directory__intro">
            <div>
              <p className="leadership-eyebrow">
                <span>02</span>
                Operational leadership
              </p>
              <h2 id="leadership-team-title">Team leads</h2>
            </div>
            <p>
              Tengacion&apos;s team leads coordinate important day-to-day work
              across community engagement and customer support.
            </p>
          </div>

          <div className="leadership-grid leadership-grid--team">
            {TEAM_LEADS.map((leader) => (
              <article
                key={leader.id}
                id={leader.id}
                className="leadership-card"
              >
                <div className="leadership-card__portrait">
                  <img
                    src={leader.image}
                    alt={leader.imageAlt}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="leadership-card__body">
                  <p className="leadership-card__role">{leader.role}</p>
                  <h3>{leader.name}</h3>
                  <div className="leadership-card__rule" aria-hidden="true" />
                  <p className="leadership-card__bio">{leader.bio}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="leadership-interns"
          className="leadership-interns"
          aria-labelledby="leadership-interns-title"
        >
          <div className="leadership-directory__intro">
            <div>
              <p className="leadership-eyebrow">
                <span>03</span>
                Emerging talent
              </p>
              <h2 id="leadership-interns-title">Interns</h2>
            </div>
            <p>
              Tengacion&apos;s internship programme gives emerging professionals
              practical experience contributing to the company&apos;s work.
            </p>
          </div>

          <div className="leadership-grid leadership-grid--team">
            {INTERNS.map((intern) => (
              <article
                key={intern.id}
                id={intern.id}
                className="leadership-card"
              >
                <div className="leadership-card__portrait">
                  <img
                    src={intern.image}
                    alt={intern.imageAlt}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="leadership-card__body">
                  <p className="leadership-card__role">{intern.role}</p>
                  <h3>{intern.name}</h3>
                  <div className="leadership-card__rule" aria-hidden="true" />
                  <p className="leadership-card__bio">{intern.bio}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="leadership-founder"
          aria-labelledby="leadership-founder-title"
        >
          <div className="leadership-founder__portrait">
            <img
              src={FOUNDER.image}
              alt={FOUNDER.imageAlt}
              loading="lazy"
              decoding="async"
            />
            <span>Founder&apos;s perspective</span>
          </div>
          <div className="leadership-founder__copy">
            <p className="leadership-eyebrow">Founder profile</p>
            <h2 id="leadership-founder-title">
              Building African social infrastructure for creators
            </h2>
            <p className="leadership-founder__bio">{FOUNDER.bio}</p>
            <div className="leadership-founder__actions">
              <Link
                className="leadership-button leadership-button--primary"
                to="/about"
              >
                About Tengacion
              </Link>
              <Link className="leadership-button" to="/contact">
                Contact the team
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="leadership-footer">
        <div className="leadership-footer__inner">
          <Link
            className="leadership-footer__brand"
            to="/"
            aria-label="Tengacion home"
          >
            <img
              src="/tengacion_logo_128.png"
              width="128"
              height="128"
              alt=""
            />
            <span>Tengacion</span>
          </Link>
          <p>
            Building trusted social infrastructure for African creators and
            communities.
          </p>
          <nav aria-label="Leadership footer navigation">
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
