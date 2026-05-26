import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";

import "./public-home.css";

const PAGE_TITLE = "Tengacion | Discover African Creators, Music, Books & Podcasts";
const PAGE_DESCRIPTION =
  "Tengacion helps fans discover African creators, stream music, read books, listen to podcasts, and follow public creator profiles.";

const DISCOVERY_LINKS = [
  {
    path: "/creators",
    label: "Creators",
    description: "Find public profiles from music artists, authors, podcast hosts, and multi-format creators.",
  },
  {
    path: "/music",
    label: "Music",
    description: "Browse songs, albums, videos, and new creator releases from public Tengacion catalogs.",
  },
  {
    path: "/books",
    label: "Books",
    description: "Explore digital books, reading previews, and author pages from Tengacion creators.",
  },
  {
    path: "/podcasts",
    label: "Podcasts",
    description: "Listen to public episodes and spoken-word releases from creators across Africa.",
  },
  {
    path: "/marketplace",
    label: "Marketplace",
    description: "Browse approved seller storefronts, products, local pickup, and delivery-ready listings.",
  },
];

const CONTENT_LINKS = [
  {
    path: "/about",
    label: "About Tengacion",
    description: "Understand the platform mission, public discovery model, and creator-first structure.",
  },
  {
    path: "/how-it-works",
    label: "How it works",
    description: "See how creator profiles, category pages, and release detail pages connect.",
  },
  {
    path: "/for-creators",
    label: "For creators",
    description: "Learn how music artists, authors, podcasters, and multi-format creators can present work.",
  },
  {
    path: "/safety",
    label: "Safety",
    description: "Review the trust, moderation, copyright, and reporting principles behind public discovery.",
  },
];

const TRUST_LINKS = [
  { path: "/about", label: "About" },
  { path: "/terms", label: "Terms" },
  { path: "/privacy", label: "Privacy" },
  { path: "/community-guidelines", label: "Guidelines" },
  { path: "/copyright-policy", label: "Copyright" },
  { path: "/contact", label: "Contact" },
];

export default function PublicHomePage() {
  return (
    <main className="public-home">
      <SeoHead
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        canonical="/"
        robots="index,follow"
        ogType="website"
        structuredData={[
          buildWebSiteJsonLd(),
          buildOrganizationJsonLd(),
          buildBreadcrumbJsonLd([{ name: "Tengacion", url: "/" }]),
        ]}
      />

      <section className="public-home__hero">
        <nav className="public-home__nav" aria-label="Public Tengacion navigation">
          <Link className="public-home__brand" to="/" aria-label="Tengacion home">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <div className="public-home__nav-actions">
            <Link to="/about">About</Link>
            <Link to="/creators">Creators</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/login">Log in</Link>
          </div>
        </nav>

        <div className="public-home__hero-inner">
          <p className="public-home__eyebrow">African creator discovery</p>
          <h1>Discover African creators, music, books and podcasts</h1>
          <p className="public-home__lede">
            Tengacion brings public creator profiles, releases, reading catalogs, and podcast
            episodes into one searchable platform for fans and supporters.
          </p>
          <div className="public-home__actions">
            <Link className="public-home__button public-home__button--primary" to="/creators">
              Find creators
            </Link>
            <Link className="public-home__button" to="/register">
              Create account
            </Link>
          </div>
        </div>
      </section>

      <section className="public-home__section" aria-labelledby="public-home-discovery-title">
        <div className="public-home__section-head">
          <p className="public-home__eyebrow">Public discovery</p>
          <h2 id="public-home-discovery-title">Explore the public catalog</h2>
          <p>
            Browse indexable creator pages and content categories that can be shared, discovered,
            and revisited without starting inside a private feed.
          </p>
        </div>

        <div className="public-home__grid">
          {DISCOVERY_LINKS.map((entry) => (
            <Link key={entry.path} className="public-home__tile" to={entry.path}>
              <span>{entry.label}</span>
              <p>{entry.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="public-home__section" aria-labelledby="public-home-learn-title">
        <div className="public-home__section-head">
          <p className="public-home__eyebrow">Platform guide</p>
          <h2 id="public-home-learn-title">Learn what Tengacion is built for</h2>
          <p>
            Public explainer pages help fans, creators, search engines, and social previews
            understand the platform beyond the private app experience.
          </p>
        </div>

        <div className="public-home__grid">
          {CONTENT_LINKS.map((entry) => (
            <Link key={entry.path} className="public-home__tile" to={entry.path}>
              <span>{entry.label}</span>
              <p>{entry.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="public-home__band" aria-label="Tengacion trust links">
        <div>
          <p className="public-home__eyebrow">Trust foundation</p>
          <h2>Platform rules and public policies are easy to reach</h2>
        </div>
        <div className="public-home__trust-links">
          {TRUST_LINKS.map((entry) => (
            <Link key={entry.path} to={entry.path}>
              {entry.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
