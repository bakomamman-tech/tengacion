import { Link } from "react-router-dom";

import CreatorSummaryFeed from "../components/creatorDiscovery/CreatorSummaryFeed";
import SeoHead from "../components/seo/SeoHead";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";

import "../components/creatorDiscovery/creatorDiscovery.css";

const CATEGORY_CONFIG = {
  music: {
    path: "/music",
    title: "African Music Releases & Creator Drops | Tengacion",
    description:
      "Discover new songs, albums, and creator releases on Tengacion. Explore public African music from independent artists and creator studios.",
    heading: "Discover Music on Tengacion",
    intro:
      "Browse public songs, albums, and creator drops from Tengacion artists. Follow the creators you love and explore full creator pages for deeper catalogs.",
    bannerTitle: "Public songs, albums, and creator drops",
    feedTitle: "Music Releases",
    feedDescription:
      "A curated public feed of songs, albums, and music creator releases on Tengacion.",
  },
  books: {
    path: "/books",
    title: "Books & Digital Reading by African Creators | Tengacion",
    description:
      "Discover public books, digital reading releases, and creator publishing pages on Tengacion.",
    heading: "Discover Books on Tengacion",
    intro:
      "Explore public books, creator publishing pages, and reading releases from Tengacion authors and storytellers.",
    bannerTitle: "Public books and reading releases",
    feedTitle: "Book Releases",
    feedDescription:
      "A curated public feed of books and reading releases from Tengacion creators.",
  },
  podcasts: {
    path: "/podcasts",
    title: "Podcasts & Spoken-Word Episodes | Tengacion",
    description:
      "Listen to public podcast episodes and spoken-word releases from Tengacion creators across Africa.",
    heading: "Discover Podcasts on Tengacion",
    intro:
      "Listen to public podcast episodes and spoken-word releases from Tengacion creators, then visit creator pages for full series and more releases.",
    bannerTitle: "Public podcast episodes and spoken-word releases",
    feedTitle: "Podcast Releases",
    feedDescription:
      "A curated public feed of podcast episodes and spoken-word creator releases.",
  },
};

const SECONDARY_LINKS = [
  { path: "/creators", label: "All creators" },
  { path: "/music", label: "Music" },
  { path: "/books", label: "Books" },
  { path: "/podcasts", label: "Podcasts" },
];

export default function PublicCategoryPage({ category = "music" }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.music;
  const structuredData = [
    buildWebSiteJsonLd(),
    buildOrganizationJsonLd(),
    buildBreadcrumbJsonLd([
      { name: "Creators", url: "/creators" },
      { name: config.heading.replace("Discover ", ""), url: config.path },
    ]),
  ];

  return (
    <section className="creator-discovery-page creator-discovery-theme">
      <SeoHead
        title={config.title}
        description={config.description}
        canonical={config.path}
        ogType="website"
        structuredData={structuredData}
      />

      <div className="creator-discovery-page__head">
        <div className="creator-discovery-page__title">
          <h1>{config.heading}</h1>
          <p>{config.intro}</p>
        </div>
        <div className="creator-summary-feed__toolbar">
          {SECONDARY_LINKS.filter((entry) => entry.path !== config.path).map((entry) => (
            <Link key={entry.path} to={entry.path} className="creator-secondary-btn">
              {entry.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="creator-discovery-page__banner">
        <div>
          <strong>{config.bannerTitle}</strong>
          <small>Every item links back to its creator page for deeper discovery.</small>
        </div>
        <small>Canonical public category page</small>
      </div>

      <CreatorSummaryFeed
        initialCategory={category}
        lockCategory
        title={config.feedTitle}
        description={config.feedDescription}
        bannerTitle={config.bannerTitle}
        actionPath="/creators"
        actionLabel="Browse creators"
        emptyTitle={`No public ${category} releases found`}
        emptyDescription={`Try browsing creators directly to discover more public ${category} pages.`}
      />
    </section>
  );
}
