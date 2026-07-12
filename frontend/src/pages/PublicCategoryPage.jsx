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
      "Trending songs, fresh drops, and editor-worthy picks make the music page feel active even before a fan opens the private feed.",
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

function CategoryReleaseCard({ item, config, onPreview }) {
  const image = getReleaseImage(item);
  const creatorRoute = getCreatorRoute(item);
  const detailRoute = getDetailRoute(item);
  const creatorName = getCreatorName(item);
  const title = item.title || "Untitled release";

  return (
    <article className="public-category-card">
      <div className="public-category-card__image" aria-hidden="true">
        {image ? <img src={image} alt="" loading="lazy" /> : <span>{getInitial(title)}</span>}
      </div>
      <div className="public-category-card__body">
        <div className="public-category-card__meta">
          <span>{item.summaryLabel || item.creatorCategory || "Release"}</span>
          <span>{formatPrice(item)}</span>
        </div>
        <h3>
          <Link to={detailRoute}>{title}</Link>
        </h3>
        <p>{item.summary || "A public Tengacion release ready for discovery."}</p>
        <div className="public-category-card__creator">
          <span>{creatorName}</span>
          {item.timestampLabel ? <small>{item.timestampLabel}</small> : null}
        </div>
        <div className="public-category-card__actions">
          <button
            type="button"
            className="creator-discovery-card__action creator-discovery-card__action--accent"
            onClick={() => onPreview(item)}
            disabled={!item.canPreview}
          >
            {config.previewLabel}
          </button>
          <Link to={creatorRoute} className="creator-discovery-card__action">
            Open Creator Page
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

    return [
      { label: "Public items", value: formatCount(allShowcaseItems.length) },
      { label: "Creators shown", value: formatCount(creatorKeys.size) },
      { label: "Preview-ready", value: formatCount(previewCount) },
      { label: "Free entries", value: formatCount(freeCount) },
    ];
  }, [allShowcaseItems]);

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

      <section className="public-category-showcase" aria-labelledby={`${resolvedCategory}-showcase-title`}>
        <div className="public-category-showcase__hero">
          <div>
            <span className="public-category-showcase__eyebrow">{config.proofLabel}</span>
            <h2 id={`${resolvedCategory}-showcase-title`}>{config.heroTitle}</h2>
            <p>{config.heroCopy}</p>
          </div>
          <div className="public-category-showcase__stats" aria-label={`${config.heading} public stats`}>
            {showcaseStats.map((stat) => (
              <span key={stat.label}>
                <strong>{showcase.loading ? "..." : stat.value}</strong>
                {stat.label}
              </span>
            ))}
          </div>
        </div>

        {showcase.error ? (
          <div className="creator-summary-feed__empty" role="status">
            <strong>Highlights could not load</strong>
            <p>{showcase.error}</p>
          </div>
        ) : null}

        {showcase.loading ? (
          <div className="public-category-showcase__loading" aria-busy="true">
            <div className="creator-summary-feed__skeleton">
              <div className="creator-summary-feed__skeleton-media" />
              <div className="creator-summary-feed__skeleton-body">
                <div className="creator-summary-feed__skeleton-line creator-summary-feed__skeleton-line--wide" />
                <div className="creator-summary-feed__skeleton-line creator-summary-feed__skeleton-line--medium" />
                <div className="creator-summary-feed__skeleton-line" />
              </div>
            </div>
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
                  <small>{formatCount(shelf.total || shelf.items.length)} tracked</small>
                </div>
                {shelf.items.length ? (
                  <div className="public-category-showcase__shelf-grid">
                    {shelf.items.map((item) => (
                      <CategoryReleaseCard
                        key={`${shelf.id}:${getItemKey(item)}`}
                        item={item}
                        config={config}
                        onPreview={handlePreview}
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
