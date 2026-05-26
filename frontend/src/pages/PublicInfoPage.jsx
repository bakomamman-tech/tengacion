import { Link } from "react-router-dom";

import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";

import "./public-info.css";

const PAGE_CONFIG = {
  about: {
    path: "/about",
    title: "About Tengacion | African Creator Discovery Platform",
    description:
      "Learn about Tengacion, a creator and social platform for discovering African music, books, podcasts, and public creator profiles.",
    eyebrow: "About Tengacion",
    heading: "A public home for African creator discovery",
    lead:
      "Tengacion helps fans find creators across music, books, podcasts, videos, and public updates. The platform is built around creator profiles that connect every public release back to the person behind it.",
    sections: [
      {
        title: "What Tengacion brings together",
        body:
          "Creator profiles, music releases, digital books, podcast episodes, and public discovery pages live in one connected platform so fans can move from a release to a deeper creator catalog.",
      },
      {
        title: "Who it is for",
        body:
          "Fans use Tengacion to discover talent, while creators use it to present their work, grow their audience, and make their public presence easier to share.",
      },
      {
        title: "Why public pages matter",
        body:
          "Indexable public pages help creator work travel beyond private feeds, social posts, and chat links into search results and share previews.",
      },
    ],
    primaryAction: { path: "/creators", label: "Browse creators" },
  },
  "how-it-works": {
    path: "/how-it-works",
    title: "How Tengacion Works | Creator Discovery, Profiles & Releases",
    description:
      "See how Tengacion connects public creator profiles, releases, discovery categories, and fan support across music, books, and podcasts.",
    eyebrow: "How it works",
    heading: "Creator profiles anchor every public release",
    lead:
      "Tengacion organizes public discovery around creators first. Music, books, podcasts, videos, and profile updates all point back to the creator page so fans can explore more from the same source.",
    sections: [
      {
        title: "Discover by category",
        body:
          "Fans can browse creators directly or explore public music, books, and podcast categories when they already know the type of content they want.",
      },
      {
        title: "Open a creator page",
        body:
          "Each public profile summarizes the creator, shows available release types, and links fans to music, albums, books, podcast episodes, and related updates.",
      },
      {
        title: "Follow the full catalog",
        body:
          "Detail pages for tracks, albums, books, and episodes use unique metadata and structured data so each public item can stand on its own in search and sharing.",
      },
    ],
    primaryAction: { path: "/music", label: "Explore music" },
  },
  "for-creators": {
    path: "/for-creators",
    title: "For Creators | Publish Music, Books & Podcasts on Tengacion",
    description:
      "Tengacion helps creators present public profiles, publish releases, and build discovery across music, books, podcasts, and fan communities.",
    eyebrow: "For creators",
    heading: "Give fans one place to understand your work",
    lead:
      "Tengacion creator pages are designed to make releases, profiles, and categories feel connected. A creator can publish across formats while fans get a simple path back to the full catalog.",
    sections: [
      {
        title: "Public profile first",
        body:
          "Your creator page introduces your identity, public releases, profile links, and available categories without making fans search through private feed activity.",
      },
      {
        title: "Multi-format publishing",
        body:
          "Music artists, authors, podcasters, and multi-format creators can use the same public discovery layer instead of splitting audience attention across disconnected pages.",
      },
      {
        title: "Built for sharing",
        body:
          "Public pages include crawlable metadata, Open Graph previews, and sitemap coverage so creator links are easier to preview, submit, and discover.",
      },
    ],
    primaryAction: { path: "/creator/register", label: "Open creator setup" },
  },
  "for-music-artists": {
    path: "/for-music-artists",
    title: "For Music Artists | Share Songs, Albums & Videos on Tengacion",
    description:
      "Music artists can use Tengacion to share public songs, albums, videos, and creator profiles for fan discovery.",
    eyebrow: "For music artists",
    heading: "Make every song lead back to your creator catalog",
    lead:
      "Tengacion gives music artists public pages for tracks, albums, videos, and creator profiles so listeners can discover one release and keep exploring.",
    sections: [
      {
        title: "Songs and albums",
        body:
          "Public track and album pages carry unique titles, descriptions, canonical links, and music structured data for stronger search and sharing context.",
      },
      {
        title: "Creator identity",
        body:
          "Artist pages connect releases to profile copy, images, genres, and related public content so new listeners understand the artist behind the catalog.",
      },
      {
        title: "Discovery paths",
        body:
          "Music category pages and creator tabs give fans multiple routes into the same catalog, from public browsing to direct release links.",
      },
    ],
    primaryAction: { path: "/music", label: "Browse music" },
  },
  "for-authors": {
    path: "/for-authors",
    title: "For Authors | Publish Books and Reading Releases on Tengacion",
    description:
      "Authors can use Tengacion public creator pages to present books, reading releases, descriptions, previews, and author profiles.",
    eyebrow: "For authors",
    heading: "Put books inside a discoverable creator profile",
    lead:
      "Tengacion helps authors make public books and reading releases discoverable alongside the broader creator identity that readers can follow.",
    sections: [
      {
        title: "Book detail pages",
        body:
          "Public book pages include title, description, cover, author, language, and canonical metadata so each release can be understood independently.",
      },
      {
        title: "Author context",
        body:
          "Creator profiles give readers a broader view of the author, including other public work, profile information, and related categories.",
      },
      {
        title: "Reader discovery",
        body:
          "The public books category gives fans and search engines a clearer path to find reading releases beyond direct links.",
      },
    ],
    primaryAction: { path: "/books", label: "Browse books" },
  },
  "for-podcasters": {
    path: "/for-podcasters",
    title: "For Podcasters | Share Podcast Episodes on Tengacion",
    description:
      "Podcasters can publish public episodes and creator pages on Tengacion for discoverable spoken-word and audio series.",
    eyebrow: "For podcasters",
    heading: "Help listeners move from one episode to the full voice",
    lead:
      "Tengacion connects podcast episodes and spoken-word releases to public creator profiles so listeners can discover, revisit, and share series content.",
    sections: [
      {
        title: "Episode metadata",
        body:
          "Podcast pages can expose episode titles, descriptions, cover art, series names, duration, and podcast structured data for richer previews.",
      },
      {
        title: "Series visibility",
        body:
          "Creator podcast tabs group public episodes so fans can understand the wider series instead of landing on isolated audio files.",
      },
      {
        title: "Cross-format discovery",
        body:
          "Podcasters who also publish books, music, videos, or updates can keep those public formats connected through the same profile.",
      },
    ],
    primaryAction: { path: "/podcasts", label: "Browse podcasts" },
  },
  safety: {
    path: "/safety",
    title: "Safety & Moderation | Tengacion",
    description:
      "Learn how Tengacion approaches community safety, copyright screening, moderation, reporting, and trustworthy public creator discovery.",
    eyebrow: "Safety and moderation",
    heading: "Public discovery works best with clear safety rules",
    lead:
      "Tengacion combines community guidelines, copyright expectations, reporting paths, and moderation workflows to support a healthier creator platform.",
    sections: [
      {
        title: "Community standards",
        body:
          "Harassment, spam, impersonation, abuse, and unsafe behavior are covered by Tengacion community rules and can lead to moderation action.",
      },
      {
        title: "Copyright responsibility",
        body:
          "Creators are responsible for rights in their uploads, while copyright policy and review signals help reduce risky public publishing.",
      },
      {
        title: "Reporting and review",
        body:
          "Public reporting and admin moderation workflows help the platform respond to content, account, safety, and trust concerns.",
      },
    ],
    primaryAction: { path: "/community-guidelines", label: "Read guidelines" },
  },
};

const RELATED_LINKS = [
  { path: "/about", label: "About" },
  { path: "/how-it-works", label: "How it works" },
  { path: "/for-creators", label: "For creators" },
  { path: "/for-music-artists", label: "Music artists" },
  { path: "/for-authors", label: "Authors" },
  { path: "/for-podcasters", label: "Podcasters" },
  { path: "/safety", label: "Safety" },
];

export default function PublicInfoPage({ pageKey = "about" }) {
  const page = PAGE_CONFIG[pageKey] || PAGE_CONFIG.about;

  return (
    <main className="public-info-page">
      <SeoHead
        title={page.title}
        description={page.description}
        canonical={page.path}
        robots="index,follow"
        ogType="website"
        structuredData={[
          buildWebSiteJsonLd(),
          buildOrganizationJsonLd(),
          buildBreadcrumbJsonLd([
            { name: "Tengacion", url: "/" },
            { name: page.eyebrow, url: page.path },
          ]),
        ]}
      />

      <section className="public-info-hero">
        <nav className="public-info-nav" aria-label="Tengacion public navigation">
          <Link className="public-info-brand" to="/">
            <img src="/tengacion_logo_128.png" alt="" />
            <span>Tengacion</span>
          </Link>
          <div className="public-info-nav__links">
            <Link to="/creators">Creators</Link>
            <Link to="/login">Log in</Link>
          </div>
        </nav>

        <div className="public-info-hero__content">
          <p className="public-info-eyebrow">{page.eyebrow}</p>
          <h1>{page.heading}</h1>
          <p>{page.lead}</p>
          <div className="public-info-actions">
            <Link className="public-info-button public-info-button--primary" to={page.primaryAction.path}>
              {page.primaryAction.label}
            </Link>
            <Link className="public-info-button" to="/about">
              About Tengacion
            </Link>
          </div>
        </div>
      </section>

      <section className="public-info-section" aria-label={`${page.eyebrow} details`}>
        <div className="public-info-grid">
          {page.sections.map((section) => (
            <article key={section.title} className="public-info-card">
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-info-band" aria-label="Related public pages">
        <div>
          <p className="public-info-eyebrow">Explore more</p>
          <h2>Public pages that strengthen discovery</h2>
        </div>
        <div className="public-info-related">
          {RELATED_LINKS.filter((entry) => entry.path !== page.path).map((entry) => (
            <Link key={entry.path} to={entry.path}>
              {entry.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
