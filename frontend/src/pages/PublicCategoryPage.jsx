import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getCreatorSummaryFeed, resolveImage } from "../api";
import SeoHead from "../components/seo/SeoHead";
import { useCreatorPlayer } from "../context/CreatorPlayerContext";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from "../lib/seo";
import { normalizePurchaseType } from "../utils/purchaseUx";

import "../components/creatorDiscovery/creatorDiscovery.css";
import "./publicCategoryPage.css";

const CATEGORY_CONFIG = {
  music: {
    path: "/music",
    title: "Discover African Gospel, Afrobeat & Independent Music Creators | Tengacion",
    description:
      "Discover African gospel, Afrobeat, and independent music creators. Stream public songs, albums, previews, and new releases on Tengacion.",
    heading: "Discover Music on Tengacion",
    intro:
      "Browse public songs, albums, and creator drops from Tengacion artists. Follow the creators you love and explore full creator pages for deeper catalogs.",
    bannerTitle: "Public songs, albums, and creator drops",
    feedTitle: "Music Releases",
    feedDescription:
      "A curated public feed of songs, albums, and music creator releases on Tengacion.",
    proofLabel: "songs and albums",
    previewLabel: "Play preview",
    heroTitle: "Stream the songs people are finding first",
    heroCopy:
      "Preview trending tracks, discover fresh drops, and go deeper into the catalogs of independent artists shaping what comes next.",
    statsLabels: ["Releases", "Artists", "Ready to play", "Free to explore"],
    shelves: [
      {
        id: "trending",
        title: "Trending Songs",
        mode: "mixed",
        description: "Popular and fast-moving music releases from public creator catalogs.",
      },
      {
        id: "new",
        title: "New Releases",
        mode: "latest",
        description: "Recent uploads from artists and music creators on Tengacion.",
      },
      {
        id: "picks",
        title: "Editor's Picks",
        mode: "classic",
        description: "Older and deeper catalog items worth resurfacing for new listeners.",
      },
    ],
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
    proofLabel: "books and excerpts",
    previewLabel: "Read preview",
    heroTitle: "Open the shelf before the sale",
    heroCopy:
      "Book covers, creator names, excerpts, and clear price labels help readers trust what they are about to preview or buy.",
    shelves: [
      {
        id: "trending",
        title: "Popular Reads",
        mode: "mixed",
        description: "Books and author releases with the strongest public discovery signals.",
      },
      {
        id: "new",
        title: "New Books",
        mode: "latest",
        description: "Fresh reading releases from Tengacion authors and storytellers.",
      },
      {
        id: "picks",
        title: "Editor's Picks",
        mode: "classic",
        description: "Backlist and long-tail reads that deserve another pass.",
      },
    ],
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
    proofLabel: "episodes and previews",
    previewLabel: "Listen preview",
    heroTitle: "Let listeners sample the conversation",
    heroCopy:
      "Episode cards with cover art, duration, creator context, and preview actions make podcast discovery feel immediate.",
    shelves: [
      {
        id: "trending",
        title: "Trending Episodes",
        mode: "mixed",
        description: "Podcast episodes and spoken-word releases getting public attention.",
      },
      {
        id: "new",
        title: "New Episodes",
        mode: "latest",
        description: "Fresh conversations from Tengacion podcast creators.",
      },
      {
        id: "picks",
        title: "Editor's Picks",
        mode: "classic",
        description: "Durable episodes that still deserve listener attention.",
      },
    ],
  },
};

const buildBookPreviewTarget = (item = {}) => {
  const itemType = normalizePurchaseType(item.itemType || item.feedItemType || item.mediaType);
  if (itemType !== "book") {
    return "";
  }

  if (item.previewUrl) {
    return item.previewUrl;
  }

  const route = item.route || (item.id ? `/books/${encodeURIComponent(item.id)}` : "");
  return route ? `${route}${route.includes("?") ? "&" : "?"}preview=chapter-one` : "";
};

const SECONDARY_LINKS = [
  { path: "/creators", label: "All creators" },
  { path: "/music", label: "Music" },
  { path: "/books", label: "Books" },
  { path: "/podcasts", label: "Podcasts" },
];

const SHOWCASE_LIMIT = 4;

const formatCount = (value = 0) => Number(value || 0).toLocaleString();

const formatPrice = (item = {}) => {
  if (item.priceLabel) {
    return item.priceLabel;
  }

  const amount = Number(item.price || item.priceValue || 0);
  if (!amount || amount <= 0) {
    return "Free";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: item.currency || "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDuration = (value = 0) => {
  const totalSeconds = Math.max(0, Math.round(Number(value) || 0));
  if (!totalSeconds) {
    return "";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const getItemKey = (item = {}) =>
  String(item.contentId || item.id || item.route || `${item.title || ""}:${item.creatorId || ""}`).trim();

const uniqueItems = (items = []) => {
  const seen = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = getItemKey(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.set(key, item);
  }
  return Array.from(seen.values());
};

const dedupeShowcaseShelves = (shelves = []) => {
  const used = new Set();

  return shelves.map((shelf) => {
    const items = [];
    for (const item of uniqueItems(shelf.items || [])) {
      const key = getItemKey(item);
      if (!key || used.has(key)) {
        continue;
      }
      used.add(key);
      items.push(item);
    }
    return { ...shelf, items };
  });
};

const getReleaseImage = (item = {}) =>
  resolveImage(item.coverImage || item.coverUrl || item.creatorBanner || item.creatorAvatar || "");

const getCreatorRoute = (item = {}) =>
  item.creatorRoute || (item.creatorId ? `/creators/${encodeURIComponent(item.creatorId)}` : "/creators");

const getDetailRoute = (item = {}) => item.route || getCreatorRoute(item);

const getCreatorName = (item = {}) => item.creatorName || item.creatorUsername || "Tengacion creator";

const getInitial = (value = "") => String(value || "T").trim().slice(0, 1).toUpperCase();

function MusicNoteIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function FeaturedMusicRelease({ item, loading, onPreview }) {
  const title = item?.title || "A new sound is on the way";
  const creatorName = item ? getCreatorName(item) : "Independent creators on Tengacion";
  const image = item ? getReleaseImage(item) : "";
  const detailRoute = item ? getDetailRoute(item) : "/creators";
  const creatorRoute = item ? getCreatorRoute(item) : "/creators";

  return (
    <article
      className={`public-category-featured${loading ? " is-loading" : ""}`}
      aria-label={loading ? "Loading featured music" : `Featured release: ${title}`}
      aria-busy={loading || undefined}
    >
      <div className="public-category-featured__artwork">
        <Link
          to={detailRoute}
          className="public-category-featured__cover"
          aria-label={item ? `Open ${title}` : "Browse music creators"}
          tabIndex={loading ? -1 : undefined}
        >
          {image ? <img src={image} alt="" /> : <span>{loading ? "" : getInitial(title)}</span>}
        </Link>
        <span className="public-category-featured__badge">
          <span aria-hidden="true" />
          Featured now
        </span>
        {item?.canPreview ? (
          <button
            type="button"
            className="public-category-featured__play"
            onClick={() => onPreview(item)}
            aria-label={`Play preview: ${title}`}
          >
            <PlayIcon />
          </button>
        ) : null}
      </div>

      <div className="public-category-featured__copy">
        <span>On Tengacion now</span>
        <h3>
          <Link to={detailRoute} tabIndex={loading ? -1 : undefined}>
            {loading ? "Loading a featured release..." : title}
          </Link>
        </h3>
        <div>
          <Link to={creatorRoute} tabIndex={loading ? -1 : undefined}>
            {creatorName}
          </Link>
          {item ? <small>{formatPrice(item)}</small> : null}
        </div>
      </div>
    </article>
  );
}

function CategoryReleaseCard({ item, config, onPreview, category }) {
  const image = getReleaseImage(item);
  const creatorAvatar = resolveImage(item.creatorAvatar || "");
  const creatorRoute = getCreatorRoute(item);
  const detailRoute = getDetailRoute(item);
  const creatorName = getCreatorName(item);
  const title = item.title || "Untitled release";
  const isMusic = category === "music";
  const duration = formatDuration(item.durationSec);
  const CardTitle = isMusic ? "h4" : "h3";

  return (
    <article className={`public-category-card${isMusic ? " public-category-card--music" : ""}`}>
      <div className="public-category-card__image">
        {isMusic ? (
          <Link to={detailRoute} className="public-category-card__image-link" aria-label={`Open ${title}`}>
            {image ? <img src={image} alt="" loading="lazy" /> : <span>{getInitial(title)}</span>}
          </Link>
        ) : image ? (
          <img src={image} alt="" loading="lazy" />
        ) : (
          <span>{getInitial(title)}</span>
        )}

        {isMusic ? (
          <>
            <div className="public-category-card__image-meta" aria-hidden="true">
              <span>{item.summaryLabel || "Music"}</span>
              <span>{formatPrice(item)}</span>
            </div>
            {duration ? <small className="public-category-card__duration">{duration}</small> : null}
            <button
              type="button"
              className="public-category-card__play"
              onClick={() => onPreview(item)}
              disabled={!item.canPreview}
              aria-label={`${config.previewLabel}: ${title}`}
            >
              <PlayIcon />
              <span>{config.previewLabel}</span>
            </button>
          </>
        ) : null}
      </div>
      <div className="public-category-card__body">
        {!isMusic ? (
          <div className="public-category-card__meta">
            <span>{item.summaryLabel || item.creatorCategory || "Release"}</span>
            <span>{formatPrice(item)}</span>
          </div>
        ) : null}
        <CardTitle>
          <Link to={detailRoute}>{title}</Link>
        </CardTitle>
        <p>{item.summary || "A public Tengacion release ready for discovery."}</p>
        <div className="public-category-card__creator">
          {isMusic ? (
            <span className="public-category-card__avatar" aria-hidden="true">
              {creatorAvatar ? <img src={creatorAvatar} alt="" loading="lazy" /> : getInitial(creatorName)}
            </span>
          ) : null}
          <span className="public-category-card__creator-copy">
            <span>{creatorName}</span>
            {item.timestampLabel ? <small>{item.timestampLabel}</small> : null}
          </span>
        </div>
        <div className="public-category-card__actions">
          {!isMusic ? (
            <button
              type="button"
              className="creator-discovery-card__action creator-discovery-card__action--accent"
              onClick={() => onPreview(item)}
              disabled={!item.canPreview}
            >
              {config.previewLabel}
            </button>
          ) : null}
          <Link
            to={creatorRoute}
            className={isMusic ? "public-category-card__creator-link" : "creator-discovery-card__action"}
            aria-label={isMusic ? `Open Creator Page for ${creatorName}` : undefined}
          >
            <span>{isMusic ? "Creator page" : "Open Creator Page"}</span>
            {isMusic ? <ArrowIcon /> : null}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function PublicCategoryPage({ category = "music" }) {
  const navigate = useNavigate();
  const creatorPlayer = useCreatorPlayer();
  const resolvedCategory = CATEGORY_CONFIG[category] ? category : "music";
  const config = CATEGORY_CONFIG[resolvedCategory];
  const isMusic = resolvedCategory === "music";
  const [showcase, setShowcase] = useState({
    loading: true,
    error: "",
    shelves: [],
  });
  const structuredData = [
    buildWebSiteJsonLd(),
    buildOrganizationJsonLd(),
    buildBreadcrumbJsonLd([
      { name: "Creators", url: "/creators" },
      { name: config.heading.replace("Discover ", ""), url: config.path },
    ]),
  ];
  const allShowcaseItems = useMemo(
    () => uniqueItems(showcase.shelves.flatMap((shelf) => shelf.items || [])),
    [showcase.shelves]
  );
  const visibleShelves = useMemo(
    () => showcase.shelves.filter((shelf) => Array.isArray(shelf.items) && shelf.items.length),
    [showcase.shelves]
  );
  const featuredItem = useMemo(
    () => allShowcaseItems.find((item) => item.canPreview) || allShowcaseItems[0] || null,
    [allShowcaseItems]
  );
  const showcaseStats = useMemo(() => {
    const creatorKeys = new Set();
    allShowcaseItems.forEach((item) => {
      const key = item.creatorId || item.creatorUsername || getCreatorName(item);
      if (key) {
        creatorKeys.add(String(key));
      }
    });

    const previewCount = allShowcaseItems.filter((item) => item.canPreview).length;
    const freeCount = allShowcaseItems.filter((item) => Number(item.price || item.priceValue || 0) <= 0).length;

    const labels = config.statsLabels || [
      "Public items",
      "Creators shown",
      "Preview-ready",
      "Free entries",
    ];

    return [
      { label: labels[0], value: formatCount(allShowcaseItems.length) },
      { label: labels[1], value: formatCount(creatorKeys.size) },
      { label: labels[2], value: formatCount(previewCount) },
      { label: labels[3], value: formatCount(freeCount) },
    ];
  }, [allShowcaseItems, config.statsLabels]);

  useEffect(() => {
    let isMounted = true;

    const loadShowcase = async () => {
      setShowcase({ loading: true, error: "", shelves: [] });

      try {
        const shelves = await Promise.all(
          config.shelves.map(async (shelf) => {
            const payload = await getCreatorSummaryFeed({
              category: resolvedCategory,
              mode: shelf.mode,
              page: 1,
              limit: SHOWCASE_LIMIT,
            });
            return {
              ...shelf,
              total: Number(payload?.total || 0),
              items: uniqueItems(payload?.items || []),
            };
          })
        );

        if (isMounted) {
          setShowcase({ loading: false, error: "", shelves: dedupeShowcaseShelves(shelves) });
        }
      } catch (err) {
        if (isMounted) {
          setShowcase({
            loading: false,
            error: err?.message || "Could not load public category highlights.",
            shelves: [],
          });
        }
      }
    };

    void loadShowcase();

    return () => {
      isMounted = false;
    };
  }, [config, resolvedCategory]);

  const handlePreview = (item = {}) => {
    if (!item.canPreview) {
      navigate(getDetailRoute(item));
      return;
    }

    const bookPreviewTarget = buildBookPreviewTarget(item);
    if (bookPreviewTarget) {
      if (creatorPlayer?.openPreview) {
        creatorPlayer.openPreview({
          ...item,
          previewUrl: bookPreviewTarget,
          initialSourceMode: "preview",
          mediaType: "document",
          itemType: "book",
        });
        return;
      }
      navigate(getDetailRoute(item));
      return;
    }

    if (creatorPlayer?.openPreview) {
      creatorPlayer.openPreview({
        ...item,
        initialSourceMode: "preview",
        mediaType: item.mediaType || (resolvedCategory === "books" ? "document" : "audio"),
      });
      return;
    }

    navigate(getDetailRoute(item));
  };

  return (
    <section
      className={`creator-discovery-page creator-discovery-theme public-category-page public-category-page--${resolvedCategory}`}
    >
      <SeoHead
        title={config.title}
        description={config.description}
        canonical={config.path}
        ogType="website"
        structuredData={structuredData}
      />

      <header className="creator-discovery-page__head public-category-header">
        <div className="creator-discovery-page__title">
          {isMusic ? (
            <span className="public-category-header__eyebrow">
              <MusicNoteIcon />
              Music discovery
            </span>
          ) : null}
          <h1>{config.heading}</h1>
          <p>{config.intro}</p>
        </div>
        <nav className="creator-summary-feed__toolbar" aria-label="Browse public creator categories">
          {SECONDARY_LINKS.filter((entry) => entry.path !== config.path).map((entry) => (
            <Link key={entry.path} to={entry.path} className="creator-secondary-btn">
              {entry.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="creator-discovery-page__banner">
        <div className="public-category-banner__message">
          {isMusic ? (
            <span className="public-category-banner__icon" aria-hidden="true">
              <MusicNoteIcon />
            </span>
          ) : null}
          <div>
            <strong>{config.bannerTitle}</strong>
            <small>Every item links back to its creator page for deeper discovery.</small>
          </div>
        </div>
        <small className="public-category-banner__status">
          <span aria-hidden="true" />
          Updated from public creator catalogs
        </small>
      </div>

      <section className="public-category-showcase" aria-labelledby={`${resolvedCategory}-showcase-title`}>
        <div className={`public-category-showcase__hero${isMusic ? " public-category-showcase__hero--music" : ""}`}>
          <div className="public-category-showcase__hero-copy">
            <span className="public-category-showcase__eyebrow">{config.proofLabel}</span>
            <h2 id={`${resolvedCategory}-showcase-title`}>{config.heroTitle}</h2>
            <p>{config.heroCopy}</p>

            {isMusic ? (
              <div className="public-category-showcase__hero-actions">
                {showcase.loading ? (
                  <button type="button" className="public-category-showcase__primary" disabled>
                    <PlayIcon />
                    Finding your next listen...
                  </button>
                ) : featuredItem?.canPreview ? (
                  <button
                    type="button"
                    className="public-category-showcase__primary"
                    onClick={() => handlePreview(featuredItem)}
                    aria-label={`Play featured release: ${featuredItem.title || "Untitled release"}`}
                  >
                    <PlayIcon />
                    Play featured
                  </button>
                ) : featuredItem ? (
                  <Link className="public-category-showcase__primary" to={getDetailRoute(featuredItem)}>
                    Open featured release
                    <ArrowIcon />
                  </Link>
                ) : (
                  <Link className="public-category-showcase__primary" to="/creators">
                    Browse music creators
                    <ArrowIcon />
                  </Link>
                )}

                {featuredItem ? (
                  <Link className="public-category-showcase__secondary" to={getCreatorRoute(featuredItem)}>
                    Meet the artist
                    <ArrowIcon />
                  </Link>
                ) : null}
              </div>
            ) : null}

            {isMusic ? (
              <dl className="public-category-showcase__stats public-category-showcase__stats--music" aria-label={`${config.heading} public stats`}>
                {showcaseStats.map((stat) => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{showcase.loading ? "..." : stat.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {isMusic ? (
            <FeaturedMusicRelease item={featuredItem} loading={showcase.loading} onPreview={handlePreview} />
          ) : (
            <div className="public-category-showcase__stats" aria-label={`${config.heading} public stats`}>
              {showcaseStats.map((stat) => (
                <span key={stat.label}>
                  <strong>{showcase.loading ? "..." : stat.value}</strong>
                  {stat.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {showcase.error ? (
          <div className="creator-summary-feed__empty" role="status">
            <strong>Highlights could not load</strong>
            <p>{showcase.error}</p>
          </div>
        ) : null}

        {showcase.loading ? (
          <div
            className={`public-category-showcase__loading${isMusic ? " public-category-showcase__loading--music" : ""}`}
            aria-busy="true"
            aria-label={`Loading ${resolvedCategory} releases`}
          >
            {isMusic ? (
              Array.from({ length: SHOWCASE_LIMIT }, (_, index) => (
                <div key={index} className="public-category-card public-category-card--skeleton" aria-hidden="true">
                  <div className="public-category-card__skeleton-art" />
                  <div className="public-category-card__skeleton-copy">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ))
            ) : (
              <div className="creator-summary-feed__skeleton">
                <div className="creator-summary-feed__skeleton-media" />
                <div className="creator-summary-feed__skeleton-body">
                  <div className="creator-summary-feed__skeleton-line creator-summary-feed__skeleton-line--wide" />
                  <div className="creator-summary-feed__skeleton-line creator-summary-feed__skeleton-line--medium" />
                  <div className="creator-summary-feed__skeleton-line" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="public-category-showcase__shelves">
            {visibleShelves.length ? visibleShelves.map((shelf) => (
              <section key={shelf.id} className="public-category-showcase__shelf" aria-labelledby={`${resolvedCategory}-${shelf.id}-title`}>
                <div className="public-category-showcase__shelf-head">
                  <div>
                    <h3 id={`${resolvedCategory}-${shelf.id}-title`}>{shelf.title}</h3>
                    <p>{shelf.description}</p>
                  </div>
                  <small>
                    {formatCount(shelf.total || shelf.items.length)} {isMusic ? "releases" : "tracked"}
                  </small>
                </div>
                {shelf.items.length ? (
                  <div className="public-category-showcase__shelf-grid">
                    {shelf.items.map((item) => (
                      <CategoryReleaseCard
                        key={`${shelf.id}:${getItemKey(item)}`}
                        item={item}
                        config={config}
                        onPreview={handlePreview}
                        category={resolvedCategory}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="creator-summary-feed__empty">
                    <strong>No {shelf.title.toLowerCase()} yet</strong>
                    <p>
                      As creators publish public {config.proofLabel}, this shelf will fill with
                      real previews and creator page links.
                    </p>
                    <Link to="/creators" className="creator-primary-btn">
                      Browse creators
                    </Link>
                  </div>
                )}
              </section>
            )) : (
              <div className="creator-summary-feed__empty">
                <strong>No public {resolvedCategory} releases found</strong>
                <p>Browse creator pages directly or check back as more public releases are approved.</p>
                <Link to="/creators" className="creator-primary-btn">
                  Browse creators
                </Link>
              </div>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
