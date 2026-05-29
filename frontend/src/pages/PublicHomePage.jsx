import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getCreatorSummaryFeed, getPublicActivity, resolveImage } from "../api";
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
const HOME_RELEASE_LIMIT = 6;
const HOME_ACTIVITY_LIMIT = 6;

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
  {
    path: "/activity",
    label: "Activity",
    description: "See recent public posts, reactions, comments, and updates from Tengacion members.",
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
  { path: "/child-safety", label: "Child safety" },
  { path: "/refund-policy", label: "Refunds" },
  { path: "/copyright-policy", label: "Copyright" },
  { path: "/contact", label: "Contact" },
];

const PATHWAYS = [
  {
    path: "/music",
    label: "Start listening",
    description: "Jump into public releases, albums, videos, and creator catalogs.",
  },
  {
    path: "/creators",
    label: "Find creators",
    description: "Browse public profiles and follow the people building on Tengacion.",
  },
  {
    path: "/creator/register",
    label: "Join as a creator",
    description: "Set up your creator page and start preparing your first public release.",
  },
  {
    path: "/marketplace",
    label: "Open marketplace",
    description: "Discover seller storefronts, products, pickup, and delivery options.",
  },
];

const TRUST_SIGNALS = [
  "Secured payment flow",
  "Refund and dispute policy",
  "Public reporting routes",
  "Copyright takedown process",
];

const formatCount = (value = 0) => Number(value || 0).toLocaleString();

const formatMoney = (value) => {
  const amount = Number(value || 0);
  if (!amount || amount <= 0) {
    return "Free preview";
  }

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
};

const truncateText = (value = "", maxLength = 140) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

const getCreatorName = (item = {}) =>
  item.creatorName ||
  item.name ||
  item.creator?.name ||
  item.creator?.username ||
  item.creatorUsername ||
  "Tengacion creator";

const getReleaseLabel = (item = {}) =>
  item.summaryLabel ||
  item.categoryLabel ||
  item.kindLabel ||
  item.contentTypeLabel ||
  item.typeLabel ||
  "Creator release";

const getReleaseImage = (item = {}) =>
  resolveImage(
    item.coverImage ||
      item.coverUrl ||
      item.artworkUrl ||
      item.thumbnailUrl ||
      item.image ||
      item.creatorAvatar ||
      item.creator?.avatar ||
      ""
  );

const getReleaseRoute = (item = {}) => {
  if (item.route) {
    return item.route;
  }

  if (item.creatorRoute) {
    return item.creatorRoute;
  }

  const creatorId = item.creatorId || item.creator?._id || item.creator?.id;
  return creatorId ? `/creators/${encodeURIComponent(creatorId)}` : "/creators";
};

const getActivityAuthorName = (post = {}) =>
  post.name || post.user?.name || post.username || post.user?.username || "Tengacion member";

const getActivityKind = (post = {}) => {
  const type = String(post.type || "post").trim().toLowerCase();
  if (type === "reel") {
    return "Reel";
  }
  if (type === "video") {
    return "Video";
  }
  if (type === "image") {
    return "Photo";
  }
  if (type === "poll") {
    return "Poll";
  }
  if (type === "quiz") {
    return "Quiz";
  }
  return "Post";
};

const getActivityRoute = (post = {}) => (post._id ? `/activity#post-${post._id}` : "/activity");

const ReleaseSkeleton = () => (
  <article className="public-home-release public-home-release--loading" aria-hidden="true">
    <div className="public-home-release__art" />
    <div className="public-home-release__body">
      <span />
      <strong />
      <p />
    </div>
  </article>
);

export default function PublicHomePage() {
  const [releaseItems, setReleaseItems] = useState([]);
  const [releaseTotal, setReleaseTotal] = useState(0);
  const [activityItems, setActivityItems] = useState([]);
  const [loadingProof, setLoadingProof] = useState(true);
  const [proofError, setProofError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadPublicProof = async () => {
      setLoadingProof(true);
      setProofError("");

      try {
        const [feedPayload, activityPayload] = await Promise.all([
          getCreatorSummaryFeed({
            category: "all",
            mode: "mixed",
            page: 1,
            limit: HOME_RELEASE_LIMIT,
          }),
          getPublicActivity({ limit: HOME_ACTIVITY_LIMIT }),
        ]);

        if (!isMounted) {
          return;
        }

        const feedItems = Array.isArray(feedPayload?.items) ? feedPayload.items : [];
        setReleaseItems(feedItems);
        setReleaseTotal(Number(feedPayload?.total || feedItems.length || 0));
        setActivityItems(Array.isArray(activityPayload) ? activityPayload : []);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setProofError(err?.message || "Public content could not load right now.");
        setReleaseItems([]);
        setReleaseTotal(0);
        setActivityItems([]);
      } finally {
        if (isMounted) {
          setLoadingProof(false);
        }
      }
    };

    void loadPublicProof();

    return () => {
      isMounted = false;
    };
  }, []);

  const proofStats = useMemo(() => {
    const creatorKeys = new Set();
    releaseItems.forEach((item) => {
      const key = item.creatorId || item.creatorUsername || item.creatorRoute || getCreatorName(item);
      if (key) {
        creatorKeys.add(String(key));
      }
    });
    activityItems.forEach((post) => {
      const key = post.user?._id || post.user?.id || post.username || getActivityAuthorName(post);
      if (key) {
        creatorKeys.add(String(key));
      }
    });

    const activityTotals = activityItems.reduce(
      (acc, post) => ({
        reactions: acc.reactions + Number(post.likesCount || post.likes || 0),
        comments: acc.comments + Number(post.commentsCount || 0),
      }),
      { reactions: 0, comments: 0 }
    );

    return [
      {
        label: "Public releases loaded",
        value: formatCount(Math.max(releaseTotal, releaseItems.length)),
        detail: releaseItems.length ? "Music, books, podcasts, and creator media" : "Ready for creator uploads",
      },
      {
        label: "Creator signals",
        value: formatCount(creatorKeys.size),
        detail: creatorKeys.size ? "Creators visible in the public surface" : "Profiles appear as creators publish",
      },
      {
        label: "Recent public posts",
        value: formatCount(activityItems.length),
        detail: "Approved community activity",
      },
      {
        label: "Engagement sampled",
        value: formatCount(activityTotals.reactions + activityTotals.comments),
        detail: "Reactions and comments from public posts",
      },
    ];
  }, [activityItems, releaseItems, releaseTotal]);

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
            <Link to="/music">Music</Link>
            <Link to="/activity">Activity</Link>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/login">Log in</Link>
          </div>
        </nav>

        <div className="public-home__hero-inner">
          <p className="public-home__eyebrow">African creator discovery</p>
          <h1>Discover creators you can stream, read, follow, and support</h1>
          <p className="public-home__lede">
            Tengacion brings public creator profiles, music releases, reading catalogs, podcast
            episodes, marketplace listings, and community activity into one searchable home.
          </p>
          <div className="public-home__actions">
            <Link className="public-home__button public-home__button--primary" to="/music">
              Start listening
            </Link>
            <Link className="public-home__button" to="/creators">
              Find creators
            </Link>
            <Link className="public-home__button" to="/creator/register">
              Join as creator
            </Link>
          </div>

          <div className="public-home__hero-proof" aria-label="Tengacion public proof points">
            <span>Creator profiles</span>
            <span>Music and books</span>
            <span>Marketplace trust</span>
            <span>Safety routes</span>
          </div>
        </div>
      </section>

      <section className="public-home__proof" aria-label="Live Tengacion proof">
        {proofStats.map((stat) => (
          <div key={stat.label} className="public-home__proof-card">
            <strong>{loadingProof ? "..." : stat.value}</strong>
            <span>{stat.label}</span>
            <p>{stat.detail}</p>
          </div>
        ))}
      </section>

      <section className="public-home__section public-home__section--live" aria-labelledby="public-home-live-title">
        <div className="public-home__section-head public-home__section-head--split">
          <div>
            <p className="public-home__eyebrow">Live public surface</p>
            <h2 id="public-home-live-title">See what is active right now</h2>
            <p>
              Browse current public releases and approved community updates from creators and
              members across the platform.
            </p>
          </div>
          <Link className="public-home__section-link" to="/activity">
            View all activity
          </Link>
        </div>

        {proofError ? (
          <div className="public-home__empty" role="status">
            <strong>Public proof could not load</strong>
            <p>{proofError}</p>
          </div>
        ) : null}

        <div className="public-home__live-layout">
          <div className="public-home__live-column">
            <div className="public-home__subhead">
              <h3>Featured public releases</h3>
              <Link to="/music">Browse music</Link>
            </div>

            {loadingProof ? (
              <div className="public-home__release-grid" aria-busy="true">
                <ReleaseSkeleton />
                <ReleaseSkeleton />
                <ReleaseSkeleton />
              </div>
            ) : releaseItems.length ? (
              <div className="public-home__release-grid">
                {releaseItems.map((item) => {
                  const image = getReleaseImage(item);
                  return (
                    <Link
                      key={item.id || item._id || `${item.title}-${getCreatorName(item)}`}
                      className="public-home-release"
                      to={getReleaseRoute(item)}
                    >
                      <div className="public-home-release__art" aria-hidden="true">
                        {image ? (
                          <img src={image} alt="" loading="lazy" />
                        ) : (
                          <span>{getCreatorName(item).slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="public-home-release__body">
                        <span>{getReleaseLabel(item)}</span>
                        <strong>{item.title || "Untitled creator release"}</strong>
                        <p>{getCreatorName(item)}</p>
                        <small>{formatMoney(item.price || item.amount || item.subscriptionPrice)}</small>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="public-home__empty">
                <strong>Public releases are ready for more content</strong>
                <p>
                  Music, books, podcasts, and videos will appear here as creators publish approved
                  public work.
                </p>
                <Link className="public-home__inline-button" to="/creator/register">
                  Upload your first release
                </Link>
              </div>
            )}
          </div>

          <aside className="public-home__activity-panel" aria-labelledby="public-home-activity-title">
            <div className="public-home__subhead">
              <h3 id="public-home-activity-title">Recent public activity</h3>
              <Link to="/activity">Open feed</Link>
            </div>

            {loadingProof ? (
              <div className="public-home__activity-list" aria-busy="true">
                {[0, 1, 2].map((entry) => (
                  <article key={entry} className="public-home-activity public-home-activity--loading">
                    <span />
                    <strong />
                    <p />
                  </article>
                ))}
              </div>
            ) : activityItems.length ? (
              <div className="public-home__activity-list">
                {activityItems.map((post) => (
                  <Link
                    key={post._id}
                    className="public-home-activity"
                    to={getActivityRoute(post)}
                  >
                    <span>{getActivityKind(post)}</span>
                    <strong>{getActivityAuthorName(post)}</strong>
                    <p>
                      {truncateText(
                        post.text ||
                          `${getActivityAuthorName(post)} shared a ${getActivityKind(post).toLowerCase()}.`
                      )}
                    </p>
                    <small>
                      {formatCount(post.likesCount || post.likes)} reactions /{" "}
                      {formatCount(post.commentsCount)} comments
                    </small>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="public-home__empty public-home__empty--compact">
                <strong>Activity will appear as posts go public</strong>
                <p>Approved posts, reactions, and comments give visitors live proof of community.</p>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="public-home__section" aria-labelledby="public-home-path-title">
        <div className="public-home__section-head">
          <p className="public-home__eyebrow">Choose your path</p>
          <h2 id="public-home-path-title">Pick up where you are</h2>
          <p>
            Start with listening, creator discovery, your creator setup, or marketplace browsing.
          </p>
        </div>

        <div className="public-home__path-grid">
          {PATHWAYS.map((entry) => (
            <Link key={entry.path} className="public-home-path" to={entry.path}>
              <strong>{entry.label}</strong>
              <p>{entry.description}</p>
            </Link>
          ))}
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
          <h2>Payments, reporting, and platform rules are easy to reach</h2>
          <div className="public-home__trust-signals" aria-label="Trust signals">
            {TRUST_SIGNALS.map((signal) => (
              <span key={signal}>{signal}</span>
            ))}
          </div>
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
